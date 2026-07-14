const request = require("supertest");
const app = require("../app");

describe("Auth", () => {
  const credentials = { fullName: "Test User", email: "test@example.com", password: "Test@123" };

  test("signup creates a user and returns a token", async () => {
    const res = await request(app).post("/api/auth/signup").send(credentials);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(credentials.email);
    expect(res.body.user.role).toBe("user");
  });

  test("signup rejects a duplicate email", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    const res = await request(app).post("/api/auth/signup").send(credentials);
    expect(res.status).toBe(409);
  });

  test("signup rejects a short password", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ ...credentials, password: "123" });
    expect(res.status).toBe(400);
  });

  test("login succeeds with correct credentials", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test("login rejects a wrong password", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  test("login rejects an unknown email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "whatever1" });
    expect(res.status).toBe(401);
  });

  test("/auth/me requires authentication", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("/auth/me returns the current user when authenticated", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(credentials);
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${signupRes.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(credentials.email);
  });

  test("PUT /auth/me updates the full name", async () => {
    const signupRes = await request(app).post("/api/auth/signup").send(credentials);
    const res = await request(app)
      .put("/api/auth/me")
      .set("Authorization", `Bearer ${signupRes.body.token}`)
      .send({ fullName: "Updated Name" });
    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe("Updated Name");
  });

  test("a request with an invalid token is rejected", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });
});
