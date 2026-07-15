jest.mock("../services/executor", () => {
  const actual = jest.requireActual("../services/executor");
  return { ...actual, runSubmission: jest.fn() };
});

const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { runSubmission } = require("../services/executor");

async function createUser({ admin = false } = {}) {
  const email = `${admin ? "admin" : "user"}-${Date.now()}-${Math.random()}@example.com`;
  await request(app).post("/api/auth/signup").send({ fullName: "Tester", email, password: "Test@123" });
  if (admin) await User.updateOne({ email }, { role: "admin" });
  const loginRes = await request(app).post("/api/auth/login").send({ email, password: "Test@123" });
  return loginRes.body.token;
}

function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString();
}

describe("Competitions", () => {
  beforeEach(() => {
    runSubmission.mockReset();
  });

  test("non-admin cannot create a competition", async () => {
    const token = await createUser();
    const res = await request(app)
      .post("/api/competitions")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Spring Cup", startTime: hoursFromNow(1), endTime: hoursFromNow(3) });
    expect(res.status).toBe(403);
  });

  test("rejects a competition where startTime is after endTime", async () => {
    const token = await createUser({ admin: true });
    const res = await request(app)
      .post("/api/competitions")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Bad Cup", startTime: hoursFromNow(3), endTime: hoursFromNow(1) });
    expect(res.status).toBe(400);
  });

  test("admin can create a competition, and status is computed correctly", async () => {
    const token = await createUser({ admin: true });
    const res = await request(app)
      .post("/api/competitions")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Spring Cup", startTime: hoursFromNow(-1), endTime: hoursFromNow(1) });
    expect(res.status).toBe(201);
    expect(res.body.competition.slug).toBe("spring-cup");

    const listRes = await request(app).get("/api/competitions");
    expect(listRes.body.competitions[0].status).toBe("live");
  });

  test("a problem created without a competition is a practice problem (competition: null)", async () => {
    const token = await createUser({ admin: true });
    const res = await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Two Sum", statement: "..." });
    expect(res.body.problem.competition).toBeNull();
    expect(res.body.problem.points).toBe(100);
  });

  test("a problem can be created scoped to a competition, with custom points", async () => {
    const token = await createUser({ admin: true });
    await request(app)
      .post("/api/competitions")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Spring Cup", startTime: hoursFromNow(-1), endTime: hoursFromNow(1) });

    const problemRes = await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Two Sum", statement: "...", competition: "spring-cup", points: 250 });
    expect(problemRes.status).toBe(201);
    expect(problemRes.body.problem.points).toBe(250);

    const compRes = await request(app).get("/api/competitions/spring-cup");
    expect(compRes.body.problems).toHaveLength(1);
    expect(compRes.body.problems[0].points).toBe(250);
  });

  test("creating a problem against an unknown competition slug fails", async () => {
    const token = await createUser({ admin: true });
    const res = await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Two Sum", statement: "...", competition: "does-not-exist" });
    expect(res.status).toBe(400);
  });

  test("deleting a competition un-scopes its problems back to practice rather than deleting them", async () => {
    const token = await createUser({ admin: true });
    await request(app)
      .post("/api/competitions")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Spring Cup", startTime: hoursFromNow(-1), endTime: hoursFromNow(1) });
    await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Two Sum", statement: "...", competition: "spring-cup" });

    const deleteRes = await request(app)
      .delete("/api/competitions/spring-cup")
      .set("Authorization", `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);

    const problemRes = await request(app).get("/api/problems/two-sum");
    expect(problemRes.status).toBe(200);
    expect(problemRes.body.problem.competition).toBeNull();
  });

  test("Accepted submissions on a competition problem earn its points; practice problems don't feed any leaderboard", async () => {
    const adminToken = await createUser({ admin: true });
    await request(app)
      .post("/api/competitions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Spring Cup", startTime: hoursFromNow(-1), endTime: hoursFromNow(1) });
    await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Two Sum",
        statement: "...",
        competition: "spring-cup",
        points: 200,
        testCases: [{ input: "2 3", output: "5", isSample: true }],
      });

    const userToken = await createUser();
    runSubmission.mockResolvedValue({ verdict: "Accepted", passedCount: 1, totalCount: 1, errorMessage: "" });

    const submitRes = await request(app)
      .post("/api/problems/two-sum/submit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ code: "print(5)", language: "python" });
    expect(submitRes.body.submission.score).toBe(200);

    const lbRes = await request(app).get("/api/competitions/spring-cup/leaderboard");
    expect(lbRes.status).toBe(200);
    expect(lbRes.body.standings).toHaveLength(1);
    expect(lbRes.body.standings[0].totalScore).toBe(200);
    expect(lbRes.body.standings[0].problemsSolved).toBe(1);
  });

  test("leaderboard ranks multiple participants by total score across problems", async () => {
    const adminToken = await createUser({ admin: true });
    await request(app)
      .post("/api/competitions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Spring Cup", startTime: hoursFromNow(-1), endTime: hoursFromNow(1) });
    await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Easy One",
        statement: "...",
        competition: "spring-cup",
        points: 100,
        testCases: [{ input: "1", output: "1", isSample: true }],
      });
    await request(app)
      .post("/api/problems")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Hard One",
        statement: "...",
        competition: "spring-cup",
        points: 300,
        testCases: [{ input: "1", output: "1", isSample: true }],
      });

    const alice = await createUser();
    const bob = await createUser();

    runSubmission.mockResolvedValue({ verdict: "Accepted", passedCount: 1, totalCount: 1, errorMessage: "" });
    // Alice solves both problems (400 total)
    await request(app).post("/api/problems/easy-one/submit").set("Authorization", `Bearer ${alice}`).send({ code: "x", language: "python" });
    await request(app).post("/api/problems/hard-one/submit").set("Authorization", `Bearer ${alice}`).send({ code: "x", language: "python" });
    // Bob only solves the easy one (100 total)
    await request(app).post("/api/problems/easy-one/submit").set("Authorization", `Bearer ${bob}`).send({ code: "x", language: "python" });

    const lbRes = await request(app).get("/api/competitions/spring-cup/leaderboard");
    expect(lbRes.body.standings).toHaveLength(2);
    expect(lbRes.body.standings[0].totalScore).toBe(400); // Alice ranked first
    expect(lbRes.body.standings[1].totalScore).toBe(100); // Bob second
  });
});

describe("DOB on signup and profile", () => {
  test("signup accepts an optional dob", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      fullName: "Rahul",
      email: `rahul-${Date.now()}@example.com`,
      password: "Test@123",
      dob: "2000-05-15",
    });
    expect(res.status).toBe(201);
    expect(new Date(res.body.user.dob).toISOString().slice(0, 10)).toBe("2000-05-15");
  });

  test("signup rejects an invalid dob", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      fullName: "Rahul",
      email: `rahul-${Date.now()}@example.com`,
      password: "Test@123",
      dob: "not-a-date",
    });
    expect(res.status).toBe(400);
  });

  test("dob can be set later via profile update", async () => {
    const email = `dobtest-${Date.now()}@example.com`;
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .send({ fullName: "Rahul", email, password: "Test@123" });
    expect(signupRes.body.user.dob).toBeFalsy();

    const updateRes = await request(app)
      .put("/api/auth/me")
      .set("Authorization", `Bearer ${signupRes.body.token}`)
      .send({ fullName: "Rahul", dob: "1999-01-01" });
    expect(new Date(updateRes.body.user.dob).toISOString().slice(0, 10)).toBe("1999-01-01");
  });
});
