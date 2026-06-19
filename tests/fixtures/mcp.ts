import {Client} from "@modelcontextprotocol/sdk/client/index.js"
import {InMemoryTransport} from "@modelcontextprotocol/sdk/inMemory.js"
import {createMcpServer, type McpServerDeps} from "../../src/server.js"

/** Client と McpServer を InMemoryTransport で結線し、接続済み Client を返す（契約テスト共通）。 */
export async function connectClient(deps: McpServerDeps): Promise<Client> {
	const server = createMcpServer(deps)
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
	const client = new Client({name: "contract-test", version: "0.0.0"})
	await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
	return client
}
