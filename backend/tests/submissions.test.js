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

  test("a Wrong Answer on a sample test case returns full input/expected/actual output", async () => {
    const adminToken = await createUser({ admin: true });
    const slug = await createProblemWithTestCase(adminToken); // its test case has isSample: true
    const userToken = await createUser();

    runSubmission.mockResolvedValue({
      verdict: "Wrong Answer",
      passedCount: 0,
      totalCount: 1,
      errorMessage: "Mismatch on test case 1",
      failedTestCase: {
        index: 1,
        input: "2 3",
        expectedOutput: "5",
        actualOutput: "-1",
        isSample: true,
      },
    });

    const res = await request(app)
      .post(`/api/problems/${slug}/submit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print(a-b)", language: "python" });

    expect(res.body.submission.failedTestCase).toEqual({
      index: 1,
      input: "2 3",
      expectedOutput: "5",
      actualOutput: "-1",
      isSample: true,
    });
  });

  test("a Wrong Answer on a HIDDEN test case redacts input/expected/actual output", async () => {
    const adminToken = await createUser({ admin: true });
    await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Hidden Case Problem",
        statement: "...",
        testCases: [{ input: "secret-input", output: "secret-output", isSample: false }],
      });
    const userToken = await createUser();

    runSubmission.mockResolvedValue({
      verdict: "Wrong Answer",
      passedCount: 0,
      totalCount: 1,
      errorMessage: "Mismatch on test case 1",
      failedTestCase: {
        index: 1,
        input: "secret-input",
        expectedOutput: "secret-output",
        actualOutput: "wrong-guess",
        isSample: false,
      },
    });

    const res = await request(app)
      .post("/api/problems/hidden-case-problem/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print('wrong-guess')", language: "python" });

    expect(res.body.submission.failedTestCase).toEqual({ index: 1, isSample: false });
    expect(JSON.stringify(res.body.submission)).not.toContain("secret-input");
    expect(JSON.stringify(res.body.submission)).not.toContain("secret-output");
  });

  test("an Accepted submission has no failedTestCase", async () => {
    const adminToken = await createUser({ admin: true });
    const slug = await createProblemWithTestCase(adminToken);
    const userToken = await createUser();

    runSubmission.mockResolvedValue({ verdict: "Accepted", passedCount: 1, totalCount: 1, errorMessage: "" });

    const res = await request(app)
      .post(`/api/problems/${slug}/submit`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print(5)", language: "python" });

    expect(res.body.submission.failedTestCase).toBeUndefined();
  });

  test("unauthenticated request cannot run code", async () => {
    const res = await request(app).post("/api/problems/two-sum/run").send({ code: "x", language: "python" });
    expect(res.status).toBe(401);
  });

  test("run tests only sample cases and does not create a Submission", async () => {
    const adminToken = await createUser({ admin: true });
    const res = await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Mixed Cases",
        statement: "...",
        testCases: [
          { input: "sample-in", output: "sample-out", isSample: true },
          { input: "hidden-in", output: "hidden-out", isSample: false },
        ],
      });
    const slug = res.body.problem.slug;
    const userToken = await createUser();

    runSubmission.mockResolvedValue({ verdict: "Accepted", passedCount: 1, totalCount: 1, errorMessage: "" });

    const runRes = await request(app)
      .post(`/api/problems/${slug}/run`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print('sample-out')", language: "python" });

    expect(runRes.status).toBe(200);
    expect(runRes.body.run.verdict).toBe("Accepted");
    // only the sample test case should have been handed to the executor
    expect(runSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ testCases: [{ input: "sample-in", output: "sample-out", isSample: true }] })
    );

    const statsRes = await request(app)
      .get("/api/submissions/stats")
      .set("Authorization", `Bearer ${userToken}`);
    expect(statsRes.body.totalSubmissions).toBe(0); // run never persists a Submission
  });

  test("run on a problem with no sample test cases is rejected", async () => {
    const adminToken = await createUser({ admin: true });
    const res = await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "All Hidden",
        statement: "...",
        testCases: [{ input: "x", output: "y", isSample: false }],
      });
    const userToken = await createUser();

    const runRes = await request(app)
      .post(`/api/problems/${res.body.problem.slug}/run`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print(1)", language: "python" });

    expect(runRes.status).toBe(400);
    expect(runSubmission).not.toHaveBeenCalled();
  });

  test("run and submit share the same rate-limit bucket", async () => {
    const adminToken = await createUser({ admin: true });
    const slug = await createProblemWithTestCase(adminToken);
    const userToken = await createUser();

    runSubmission.mockResolvedValue({ verdict: "Accepted", passedCount: 1, totalCount: 1, errorMessage: "" });

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post(`/api/problems/${slug}/run`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ code: "print(5)", language: "python" });
    }
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post(`/api/problems/${slug}/submit`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ code: "print(5)", language: "python" });
    }
    // the 11th execution request from this user this minute, run or submit, should be throttled
    const res = await request(app)
      .post(`/api/problems/${slug}/run`)
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print(5)", language: "python" });

    expect(res.status).toBe(429);
  });
});
