const request = require("supertest");
const app = require("../app");
const User = require("../models/User");

async function createUser({ admin = false } = {}) {
  const email = `${admin ? "admin" : "user"}-${Date.now()}-${Math.random()}@example.com`;
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ fullName: "Tester", email, password: "Test@123" });

  if (admin) {
    await User.updateOne({ email }, { role: "admin" });
    const loginRes = await request(app).post("/api/auth/login").send({ email, password: "Test@123" });
    return loginRes.body.token;
  }
  return res.body.token;
}

describe("Problems", () => {
  test("GET /problems returns an empty list initially", async () => {
    const res = await request(app).get("/api/problems");
    expect(res.status).toBe(200);
    expect(res.body.problems).toEqual([]);
  });

  test("non-admin cannot create a problem", async () => {
    const token = await createUser();
    const res = await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Two Sum", statement: "Add two numbers." });
    expect(res.status).toBe(403);
  });

  test("unauthenticated request cannot create a problem", async () => {
    const res = await request(app)
      .post("/api/problems")
      .send({ title: "Two Sum", statement: "Add two numbers." });
    expect(res.status).toBe(401);
  });

  test("admin can create a problem with test cases", async () => {
    const token = await createUser({ admin: true });
    const res = await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Two Sum",
        statement: "Add two numbers.",
        difficulty: "Easy",
        testCases: [
          { input: "2 3", output: "5", isSample: true },
          { input: "1 1", output: "2", isSample: false },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.problem.slug).toBe("two-sum");
  });

  test("GET /problems/:slug returns the problem with only sample test cases", async () => {
    const token = await createUser({ admin: true });
    await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Two Sum",
        statement: "Add two numbers.",
        testCases: [
          { input: "2 3", output: "5", isSample: true },
          { input: "1 1", output: "2", isSample: false },
        ],
      });

    const res = await request(app).get("/api/problems/two-sum");
    expect(res.status).toBe(200);
    expect(res.body.sampleTestCases).toHaveLength(1);
  });

  test("admin sees all test cases including hidden ones", async () => {
    const token = await createUser({ admin: true });
    await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Two Sum",
        statement: "Add two numbers.",
        testCases: [
          { input: "2 3", output: "5", isSample: true },
          { input: "1 1", output: "2", isSample: false },
        ],
      });

    const res = await request(app)
      .get("/api/problems/two-sum/testcases")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.testCases).toHaveLength(2);
  });

  test("admin can delete a single test case", async () => {
    const token = await createUser({ admin: true });
    const createRes = await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Two Sum",
        statement: "Add two numbers.",
        testCases: [{ input: "2 3", output: "5", isSample: true }],
      });

    const listRes = await request(app)
      .get("/api/problems/two-sum/testcases")
      .set("Authorization", `Bearer ${token}`);
    const testCaseId = listRes.body.testCases[0]._id;

    const deleteRes = await request(app)
      .delete(`/api/problems/two-sum/testcases/${testCaseId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const afterRes = await request(app)
      .get("/api/problems/two-sum/testcases")
      .set("Authorization", `Bearer ${token}`);
    expect(afterRes.body.testCases).toHaveLength(0);
  });

  test("admin can update and delete a problem", async () => {
    const token = await createUser({ admin: true });
    await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Two Sum", statement: "Add two numbers." });

    const updateRes = await request(app)
      .put("/api/problems/two-sum")
      .set("Authorization", `Bearer ${token}`)
      .send({ difficulty: "Hard" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.problem.difficulty).toBe("Hard");

    const deleteRes = await request(app)
      .delete("/api/problems/two-sum")
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const getRes = await request(app).get("/api/problems/two-sum");
    expect(getRes.status).toBe(404);
  });

  test("GET /problems/:slug returns 404 for an unknown slug", async () => {
    const res = await request(app).get("/api/problems/does-not-exist");
    expect(res.status).toBe(404);
  });
});
