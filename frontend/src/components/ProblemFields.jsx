export default function ProblemFields({ title, setTitle, statement, setStatement, difficulty, setDifficulty }) {
  return (
    <>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label>
        Difficulty
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
      </label>
      <label>
        Statement
        <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={6} required />
      </label>
    </>
  );
}
