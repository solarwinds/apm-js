import styles from "./page.module.css"
import { listItems, newOrDone } from "../db"

export default async function TodoPage() {
  const todo = await listItems(false)

  return (
    <form action={newOrDone}>
      <table className={styles.list}>
        {todo.map((item) => (
          <tr key={item.id}>
            <td>{item.description}</td>
            <td>
              <button type="submit" name="done" value={item.id}>
                ✓
              </button>
            </td>
          </tr>
        ))}
        <tr>
          <td>
            <input type="text" name="description" />
          </td>
          <td>
            <button type="submit">+</button>
          </td>
        </tr>
      </table>
    </form>
  )
}
