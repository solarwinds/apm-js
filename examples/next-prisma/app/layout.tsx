import "./layout.css"
import styles from "./layout.module.css"

export default function RootLayout({
  done,
  todo,
}: {
  done: React.ReactNode
  todo: React.ReactNode
}) {
  return (
    <html>
      <body>
        <main className={styles.container}>
          <h1 className={styles.title}>solarwinds-apm + Next.js + Prisma</h1>
          {done}
          {todo}
        </main>
      </body>
    </html>
  )
}
