import fastify from 'fastify'
// @ts-expect-error: no types
import WebRTCStar from 'libp2p-webrtc-star'
// @ts-expect-error: no types
import WebSocket from 'libp2p-websockets'
import fastifyCors from 'fastify-cors'
import { setSocket } from './services/signaling'
import { makeSchema } from 'nexus'
import mercurius from 'mercurius'
import { types } from './types'
import { GraphQLSchema } from 'graphql'
import path from 'path'
import { setPlayground } from './playgroud'
import { create } from '@dstack-js/ipfs'
import { Stack } from '@dstack-js/lib'
import { RedisStorage } from './services/storage'
import { getListenAddress } from './services/address'
// @ts-expect-error no types
import * as wrtc from 'wrtc'
import { getPeers } from './services/signaling/peer'
import { peersMetric, setMetrics } from './services/metrics'

export interface ListenOptions {
  namespace?: string;
  listenOn?: string;
  host?: string;
  port?: number | string;
}

export const listen = async ({
  port = process.env['PORT'] || 13579,
  host = process.env['HOST'] || '0.0.0.0',
  namespace = process.env['NAMESPACE'] || 'dstack',
  listenOn = process.env['LISTEN_ON']
}: ListenOptions = {}) => {
  const server = fastify()
  const schema = makeSchema({
    types,
    outputs: {
      schema: path.join(__dirname, 'generated/schema.graphql'),
      typegen: path.join(__dirname, 'generated/types.d.ts')
    }
  })

  setSocket(server)
  setMetrics(server)
  setPlayground(server)
  server.register(fastifyCors, { origin: '*' })
  server.register(mercurius, {
    // TODO: fix types
    schema: schema as unknown as GraphQLSchema,
    path: '/graphql'
  })

  const address = await server.listen(port, host)
  console.log('GraphQL and signalling server listening on', address)

  if (namespace) {
    const listen = [listenOn || getListenAddress('http', host, port)]

    const ipfs = await create(
      {
        init: {
          privateKey: process.env['PRIVATE_KEY']
        },
        libp2p: {
          // @ts-expect-error incompatible types
          modules: {
            transport: [WebRTCStar, WebSocket]
          },
          addresses: {
            listen
          }
        },
        relay: {
          enabled: true,
          hop: {
            enabled: true,
            active: true
          }
        },
        config: {
          Discovery: {
            webRTCStar: {
              Enabled: true
            }
          },
          Bootstrap: []
        }
      },
      wrtc
    )

    const storage = new RedisStorage(namespace)
    const stack = await Stack.create(namespace, ipfs, storage)
    const { id } = await stack.id()
    console.log('Stack created, namespace:', namespace)

    setInterval(async () => {
      const peers = await getPeers()
      peersMetric.set(peers.length)

      for (const peer of peers) {
        if (peer.includes(id)) {
          continue
        }

        stack.connect(peer).catch(console.error)
      }
    }, 5000)
  }
}
