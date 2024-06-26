/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { mockServices } from '@backstage/backend-test-utils';
import { NotificationsEmailProcessor } from './NotificationsEmailProcessor';
import { ConfigReader } from '@backstage/config';
import { JsonArray } from '@backstage/types';
import { CatalogClient } from '@backstage/catalog-client';
import { createTransport } from 'nodemailer';

const sendmailMock = jest.fn();
const mockTransport = {
  sendMail: sendmailMock,
};
jest.mock('nodemailer', () => ({
  ...jest.requireActual('nodemailer'),
  createTransport: jest.fn(),
}));

describe('NotificationsEmailProcessor', () => {
  const logger = mockServices.logger.mock();
  const auth = mockServices.auth();

  const getEntityRefMock = jest.fn();
  const getEntitiesMock = jest.fn();
  const mockCatalogClient: Partial<CatalogClient> = {
    getEntityByRef: getEntityRefMock,
    getEntities: getEntitiesMock,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should create smtp transport', async () => {
    const processor = new NotificationsEmailProcessor(
      logger,
      new ConfigReader({
        notifications: {
          processors: {
            email: {
              transport: {
                transport: 'smtp',
                hostname: 'localhost',
                port: 465,
                secure: true,
                requireTls: false,
              },
              sender: 'backstage@backstage.io',
            },
          },
        },
      }),
      mockCatalogClient as unknown as CatalogClient,
      auth,
    );

    await processor.postProcess(
      {
        origin: 'plugin',
        id: '1234',
        user: 'user:default/mock',
        created: new Date(),
        payload: { title: 'notification' },
      },
      {
        recipients: { type: 'entity', entityRef: 'user:default/mock' },
        payload: { title: 'notification' },
      },
    );

    expect(processor).toBeInstanceOf(NotificationsEmailProcessor);
    expect(createTransport as jest.Mock).toHaveBeenCalledWith({
      host: 'localhost',
      port: 465,
      requireTLS: false,
      secure: true,
    });
  });

  it('should create ses transport', async () => {
    const processor = new NotificationsEmailProcessor(
      logger,
      new ConfigReader({
        notifications: {
          processors: {
            email: {
              transport: {
                transport: 'ses',
                region: 'us-west-2',
              },
              sender: 'backstage@backstage.io',
            },
          },
        },
      }),
      mockCatalogClient as unknown as CatalogClient,
      auth,
    );

    await processor.postProcess(
      {
        origin: 'plugin',
        id: '1234',
        user: 'user:default/mock',
        created: new Date(),
        payload: { title: 'notification' },
      },
      {
        recipients: { type: 'entity', entityRef: 'user:default/mock' },
        payload: { title: 'notification' },
      },
    );

    expect(processor).toBeInstanceOf(NotificationsEmailProcessor);
    expect(createTransport as jest.Mock).toHaveBeenCalledWith({
      SES: expect.anything(),
    });
  });

  it('should create sendmail transport', async () => {
    const processor = new NotificationsEmailProcessor(
      logger,
      new ConfigReader({
        notifications: {
          processors: {
            email: {
              transport: {
                transport: 'sendmail',
                path: '/usr/local/bin/sendmail',
              },
              sender: 'backstage@backstage.io',
            },
          },
        },
      }),
      mockCatalogClient as unknown as CatalogClient,
      auth,
    );

    await processor.postProcess(
      {
        origin: 'plugin',
        id: '1234',
        user: 'user:default/mock',
        created: new Date(),
        payload: { title: 'notification' },
      },
      {
        recipients: { type: 'entity', entityRef: 'user:default/mock' },
        payload: { title: 'notification' },
      },
    );

    expect(processor).toBeInstanceOf(NotificationsEmailProcessor);
    expect(createTransport as jest.Mock).toHaveBeenCalledWith({
      sendmail: true,
      path: '/usr/local/bin/sendmail',
      newline: 'unix',
    });
  });

  it('should send user email', async () => {
    (createTransport as jest.Mock).mockReturnValue(mockTransport);
    getEntityRefMock.mockResolvedValue({
      kind: 'User',
      spec: {
        profile: {
          email: 'mock@backstage.io',
        },
      },
    });
    const processor = new NotificationsEmailProcessor(
      logger,
      new ConfigReader({
        notifications: {
          processors: {
            email: {
              transport: {
                transport: 'sendmail',
                path: '/usr/local/bin/sendmail',
              },
              sender: 'backstage@backstage.io',
            },
          },
        },
      }),
      mockCatalogClient as unknown as CatalogClient,
      auth,
    );

    await processor.postProcess(
      {
        origin: 'plugin',
        id: '1234',
        user: 'user:default/mock',
        created: new Date(),
        payload: { title: 'notification' },
      },
      {
        recipients: { type: 'entity', entityRef: 'user:default/mock' },
        payload: { title: 'notification' },
      },
    );

    expect(sendmailMock).toHaveBeenCalledWith({
      from: 'backstage@backstage.io',
      html: '<p></p>',
      replyTo: undefined,
      subject: 'notification',
      text: '',
      to: 'mock@backstage.io',
    });
  });

  it('should send email to all', async () => {
    (createTransport as jest.Mock).mockReturnValue(mockTransport);
    getEntitiesMock.mockResolvedValue({
      items: [
        {
          kind: 'User',
          spec: {
            profile: {
              email: 'mock@backstage.io',
            },
          },
        },
      ],
    });
    const processor = new NotificationsEmailProcessor(
      logger,
      new ConfigReader({
        notifications: {
          processors: {
            email: {
              transport: {
                transport: 'sendmail',
                path: '/usr/local/bin/sendmail',
              },
              sender: 'backstage@backstage.io',
              broadcastConfig: {
                receiver: 'users',
              },
            },
          },
        },
      }),
      mockCatalogClient as unknown as CatalogClient,
      auth,
    );

    await processor.postProcess(
      {
        origin: 'plugin',
        id: '1234',
        user: null,
        created: new Date(),
        payload: { title: 'notification' },
      },
      {
        recipients: { type: 'broadcast' },
        payload: { title: 'notification' },
      },
    );

    expect(sendmailMock).toHaveBeenCalledWith({
      from: 'backstage@backstage.io',
      html: '<p></p>',
      replyTo: undefined,
      subject: 'notification',
      text: '',
      to: 'mock@backstage.io',
    });
  });

  it('should send email to configured addresses', async () => {
    (createTransport as jest.Mock).mockReturnValue(mockTransport);
    getEntitiesMock.mockResolvedValue({
      items: [
        {
          kind: 'User',
          spec: {
            profile: {
              email: 'mock@backstage.io',
            },
          },
        },
      ],
    });
    const processor = new NotificationsEmailProcessor(
      logger,
      new ConfigReader({
        notifications: {
          processors: {
            email: {
              transport: {
                transport: 'sendmail',
                path: '/usr/local/bin/sendmail',
              },
              sender: 'backstage@backstage.io',
              broadcastConfig: {
                receiver: 'config',
                receiverEmails: ['broadcast@backstage.io'] as JsonArray,
              },
            },
          },
        },
      }),
      mockCatalogClient as unknown as CatalogClient,
      auth,
    );

    await processor.postProcess(
      {
        origin: 'plugin',
        id: '1234',
        user: null,
        created: new Date(),
        payload: { title: 'notification' },
      },
      {
        recipients: { type: 'broadcast' },
        payload: { title: 'notification' },
      },
    );

    expect(sendmailMock).toHaveBeenCalledWith({
      from: 'backstage@backstage.io',
      html: '<p></p>',
      replyTo: undefined,
      subject: 'notification',
      text: '',
      to: 'broadcast@backstage.io',
    });
  });
});
