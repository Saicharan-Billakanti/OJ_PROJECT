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

describe("Password reset", () => {
  const credentials = { fullName: "Reset User", email: "reset@example.com", password: "Original@123" };

  test("forgot-password gives the same generic message whether or not the email is registered", async () => {
    await request(app).post("/api/auth/signup").send(credentials);

    const knownRes = await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    const unknownRes = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });

    expect(knownRes.status).toBe(200);
    expect(unknownRes.status).toBe(200);
    expect(knownRes.body.message).toBe(unknownRes.body.message);
  });

  test("forgot-password surfaces a dev reset link when the email is registered, not for unknown ones", async () => {
    await request(app).post("/api/auth/signup").send(credentials);

    const res = await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    expect(res.body.devResetUrl).toBeTruthy();
    expect(res.body.devResetUrl).toContain("/reset-password/");
  });

  test("a valid reset token successfully changes the password, and can log in with the new one", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    const forgotRes = await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    const token = forgotRes.body.devResetUrl.split("/reset-password/")[1];

    const resetRes = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "NewPassword@456" });
    expect(resetRes.status).toBe(200);

    const oldLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: credentials.password });
    expect(oldLoginRes.status).toBe(401);

    const newLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: "NewPassword@456" });
    expect(newLoginRes.status).toBe(200);
  });

  test("reset-password rejects an invalid or unknown token", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "not-a-real-token", newPassword: "Whatever@123" });
    expect(res.status).toBe(400);
  });

  test("reset-password rejects a token that has already been used", async () => {
    await request(app).post("/api/auth/signup").send(credentials);
    const forgotRes = await request(app).post("/api/auth/forgot-password").send({ email: credentials.email });
    const token = forgotRes.body.devResetUrl.split("/reset-password/")[1];

    const firstUse = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "FirstReset@123" });
    expect(firstUse.status).toBe(200);

    const secondUse = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "SecondReset@123" });
    expect(secondUse.status).toBe(400);
  });
});
