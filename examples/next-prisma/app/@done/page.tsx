import styles from "./page.module.css"
import { listItems } from "../db"

export default async function DonePage() {
  const done = await listItems(true)

  return (
    <table className={styles.list}>
      {done.map((item) => (
        <tr key={item.id}>
          <td>{item.description}</td>
        </tr>
      ))}
    </table>
  )
}
