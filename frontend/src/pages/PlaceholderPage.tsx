interface Props {
  title: string
  text: string
}

export default function PlaceholderPage({ title, text }: Props) {
  return (
    <div className="page">
      <header className="simple-header">
        <h1>{title}</h1>
      </header>
      <main className="page-content">
        <div className="empty">
          <p>{text}</p>
        </div>
      </main>
    </div>
  )
}
