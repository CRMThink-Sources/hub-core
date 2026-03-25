import { User } from 'lucide-react'

export const TimelineComments = () => {
  const comments = [
    {
      id: 1,
      text: 'Muito bem feito!',
      createdAt: '2026-03-18 10:00:00',
      author: 'John Doe',
      authorImage: 'https://via.placeholder.com/150',
    },
    {
      id: 2,
      text: 'Muito bem feito!',
      createdAt: '2026-03-18 10:00:00',
      author: 'Jane Doe',
      authorImage: 'https://via.placeholder.com/150',
    },
    {
      id: 3,
      text: 'Muito bem feito!',
      createdAt: '2026-03-18 10:00:00',
      author: 'John Doe',
      authorImage: 'https://via.placeholder.com/150',
    },
  ]
  // Collapsible
  return (
    <div className="flex flex-col gap-4">
      {/* <h3 className="text-lg font-semibold">Comentários</h3> */}

      <div className="flex flex-col gap-2">
        {comments.map(comment => (
          <div key={comment.id} className="rounded-md bg-white shadow-sm p-2">
            {/* <h3 className="text-sm font-semibold border-b border-slate-200">
                Comentário
              </h3> */}
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-full bg-slate-100">
                <User className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-semibold">{comment.author}</h3>
            </div>
            <p className="text-base mt-2 text-slate-600">{comment.text}</p>
            <p className="text-xs text-slate-500 text-end">
              {new Date(comment.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        ))}
      </div>

      <form className="flex flex-col gap-2">
        <textarea
          className="w-full rounded-md border border-slate-200 p-2 bg-white"
          placeholder="Digite seu comentário"
        />
        <button className="w-full rounded-md bg-indigo-600 text-white p-2">
          Enviar
        </button>
      </form>
    </div>
  )
}
