jest.mock("../services/executor", () => {
  const actual = jest.requireActual("../services/executor");
  return { ...actual, runSubmission: jest.fn() };
});

const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { runSubmission, ServerBusyError, MAX_CODE_LENGTH } = require("../services/executor");

async function createUser({ admin = false } = {}) {
  const email = `${admin ? "admin" : "user"}-${Date.now()}-${Math.random()}@example.com`;
  await request(app).post("/api/auth/signup").send({ fullName: "Tester", email, password: "Test@123" });
  if (admin) await User.updateOne({ email }, { role: "admin" });
  const loginRes = await request(app).post("/api/auth/login").send({ email, password: "Test@123" });
  return loginRes.body.token;
}

async function createProblemWithTestCase(adminToken) {
  const res = await request(app)
    .post("/api/problems")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: "Two Sum",
      statement: "Add two numbers.",
      testCases: [{ input: "2 3", output: "5", isSample: true }],
    });
  return res.body.problem.slug;
}

describe("Submissions", () => {
  beforeEach(() => {
    runSubmission.mockReset();
  });

  test("unauthenticated request cannot submit", async () => {
    const res = await request(app).post("/api/problems/two-sum/submit").send({ code: "x", language: "python" });
    expect(res.status).toBe(401);
  });

  test("rejects an unsupported language", async () => {
    const adminToken = await createUser({ admin: true });
    const slug = await createProblemWithTestCase(adminToken);
    const userToken = await createUser();

    const res = await request(app)
      .post(`/api/problems/${slug}/submit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print(1)", language: "brainfuck" });
    expect(res.status).toBe(400);
    expect(runSubmission).not.toHaveBeenCalled();
  });

  test("rejects code over the length limit before touching the executor", async () => {
    const adminToken = await createUser({ admin: true });
    const slug = await createProblemWithTestCase(adminToken);
    const userToken = await createUser();

    const res = await request(app)
      .post(`/api/problems/${slug}/submit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "a".repeat(MAX_CODE_LENGTH + 1), language: "python" });
    expect(res.status).toBe(400);
    expect(runSubmission).not.toHaveBeenCalled();
  });

  test("rejects submission to a problem with no test cases", async () => {
    const adminToken = await createUser({ admin: true });
    await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "No Cases", statement: "..." });
    const userToken = await createUser();

    const res = await request(app)
      .post("/api/problems/no-cases/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print(1)", language: "python" });
    expect(res.status).toBe(400);
  });

  test("a correct submission is saved as Accepted", async () => {
    const adminToken = await createUser({ admin: true });
    const slug = await createProblemWithTestCase(adminToken);
    const userToken = await createUser();

    runSubmission.mockResolvedValue({
      verdict: "Accepted",
      passedCount: 1,
      totalCount: 1,
      errorMessage: "",
    });

    const res = await request(app)
      .post(`/api/problems/${slug}/submit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print(5)", language: "python" });

    expect(res.status).toBe(200);
    expect(res.body.submission.verdict).toBe("Accepted");
    expect(runSubmission).toHaveBeenCalledTimes(1);
  });

  test("returns 503 when the executor is at capacity", async () => {
    const adminToken = await createUser({ admin: true });
    const slug = await createProblemWithTestCase(adminToken);
    const userToken = await createUser();

    runSubmission.mockRejectedValue(new ServerBusyError("Judge is at capacity, try again shortly"));

    const res = await request(app)
      .post(`/api/problems/${slug}/submit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print(5)", language: "python" });

    expect(res.status).toBe(503);
  });

  test("listMySubmissions only returns the caller's own submissions", async () => {
    const adminToken = await createUser({ admin: true });
    const slug = await createProblemWithTestCase(adminToken);
    const userAToken = await createUser();
    const userBToken = await createUser();

    runSubmission.mockResolvedValue({ verdict: "Accepted", passedCount: 1, totalCount: 1, errorMessage: "" });

    await request(app)
      .post(`/api/problems/${slug}/submit`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ code: "print(5)", language: "python" });

    const res = await request(app)
      .get("/api/submissions/mine")
      .set("Authorization", `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(0);
  });

  test("a user cannot view another user's submission by id, but an admin can", async () => {
    const adminToken = await createUser({ admin: true });
    const slug = await createProblemWithTestCase(adminToken);
    const userAToken = await createUser();
    const userBToken = await createUser();

    runSubmission.mockResolvedValue({ verdict: "Accepted", passedCount: 1, totalCount: 1, errorMessage: "" });

    const submitRes = await request(app)
      .post(`/api/problems/${slug}/submit`)
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ code: "print(5)", language: "python" });
    const submissionId = submitRes.body.submission._id;

    const forbiddenRes = await request(app)
      .get(`/api/submissions/${submissionId}`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(forbiddenRes.status).toBe(403);

    const adminRes = await request(app)
      .get(`/api/submissions/${submissionId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
  });

  test("stats reflect submission history accurately", async () => {
    const adminToken = await createUser({ admin: true });
    const slug = await createProblemWithTestCase(adminToken);
    const userToken = await createUser();

    runSubmission
      .mockResolvedValueOnce({ verdict: "Wrong Answer", passedCount: 0, totalCount: 1, errorMessage: "" })
      .mockResolvedValueOnce({ verdict: "Accepted", passedCount: 1, totalCount: 1, errorMessage: "" });

    await request(app)
      .post(`/api/problems/${slug}/submit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print(0)", language: "python" });
    await request(app)
      .post(`/api/problems/${slug}/submit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print(5)", language: "python" });

    const res = await request(app)
      .get("/api/submissions/stats")
      .set("Authorization", `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalSubmissions).toBe(2);
    expect(res.body.acceptedSubmissions).toBe(1);
    expect(res.body.problemsSolved).toBe(1);
  });
});
