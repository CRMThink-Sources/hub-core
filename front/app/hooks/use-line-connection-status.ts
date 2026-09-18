import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { envConfig } from '@/shared/infra/env-config'

/** Intervalo da releitura de recuperação. */
const POLL_MS = 8_000

/**
 * Teto de tentativas (~10 minutos).
 *
 * O cenário real é a tela do QR code ficar aberta enquanto a pessoa procura o
 * celular. Sem teto, uma aba esquecida marteia a leitura de conexão — que consulta
 * o provider ao vivo a cada chamada — indefinidamente.
 */
const MAX_POLLS = 75

const SOCKET_PATH = '/api/socket.io'

/**
 * Origem do socket, tolerante ao formato de `NEXT_PUBLIC_API_URL`.
 *
 * O valor padrão do projeto é **`/api`** — caminho relativo, não URL. A api é
 * servida na mesma origem do front: por rewrite do Next em desenvolvimento
 * (`next.config.ts:26-29`) e pelo proxy em produção, onde o rewrite não existe.
 * `new URL('/api')` lança `Invalid URL`, e lançar dentro do efeito derruba a tela
 * inteira — foi o que aconteceu ao ligar este hook.
 *
 * Com `apiUrl` absoluto (deploy em que a api tem host próprio), o socket vai para
 * a origem dela. O `path` continua constante nos dois casos: quem o define é o
 * servidor, em `initSocket`.
 */
function resolveSocketOrigin(): string | null {
  if (typeof window === 'undefined') return null

  try {
    return new URL(envConfig.apiUrl).origin
  } catch {
    return window.location.origin
  }
}

/**
 * Avisa a tela quando o estado de conexão da linha muda, por dois caminhos.
 *
 * **Socket** (`providerRef` é o `instanceId` da Z-API, que também nomeia a sala):
 * o webhook `ConnectedCallback` chega na api e ela emite na sala. É o caminho
 * rápido — cerca de um segundo.
 *
 * **Releitura periódica**: roda em paralelo, sempre. Não é redundância — o socket
 * falha em silêncio em quatro pontos fora do nosso controle: webhook que não chega,
 * proxy que barra o upgrade para WebSocket, rede que bloqueia, e o caso mais
 * provável no caminho feliz, o evento chegando **antes** de o cliente entrar na
 * sala (o Socket.IO não entrega a quem entrou depois). Em qualquer um deles a tela
 * voltaria a só mudar no F5, sem sinal de que quebrou.
 *
 * Os dois caminhos chamam o mesmo `onChange`, que relê pela rota autenticada. O
 * socket nunca carrega estado: o payload é só `{ status }`, então não existe o caso
 * de o evento e a rota discordarem na tela.
 */
export function useLineConnectionStatus({
  providerRef,
  subscribe,
  poll,
  onChange,
}: {
  /** Id da linha no provider. `null` quando a linha ainda não foi provisionada. */
  providerRef: string | null
  /**
   * Assinar a sala. Vale com a linha conectada também — é assim que a tela
   * percebe uma desconexão sem que o usuário recarregue.
   */
  subscribe: boolean
  /**
   * Rodar a releitura periódica. Separada de `subscribe` porque tem custo: cada
   * tentativa consulta o provider ao vivo. Só faz sentido enquanto a tela espera
   * uma conexão acontecer.
   */
  poll: boolean
  onChange: () => void
}) {
  /**
   * O callback vem por ref para que uma nova identidade a cada render não derrube
   * o socket nem reinicie o intervalo — o que zeraria a contagem de tentativas e
   * anularia o teto.
   */
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!subscribe || !providerRef) return

    const origin = resolveSocketOrigin()
    if (!origin) return

    const socket = io(origin, {
      autoConnect: false,
      path: SOCKET_PATH,
      /**
       * O upgrade nativo para WebSocket não permite headers customizados no
       * browser, mas o handshake inicial por polling usa XHR — isto evita o
       * aviso de "visitante" do ngrok free tier nesse primeiro request.
       */
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
    })

    socket.on('connect', () => {
      socket.emit('join', providerRef)
    })

    socket.on('instance:connected', () => onChangeRef.current?.())
    socket.on('connector:disconnected', () => onChangeRef.current?.())

    socket.connect()

    return () => {
      socket.emit('leave', providerRef)
      socket.disconnect()
    }
  }, [subscribe, providerRef])

  /**
   * Independente do socket **e do `providerRef`**: linha sem id no provider não tem
   * sala para entrar, e é justamente o caso em que a releitura é a única saída.
   */
  useEffect(() => {
    if (!poll) return

    let remaining = MAX_POLLS
    const timer = setInterval(() => {
      if (remaining <= 0) {
        clearInterval(timer)
        return
      }
      remaining -= 1
      onChangeRef.current?.()
    }, POLL_MS)

    return () => clearInterval(timer)
  }, [poll])
}
