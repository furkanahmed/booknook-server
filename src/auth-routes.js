import express from "express";
import jwt from "jsonwebtoken";

// Route: POST /auth/login (Issue a valid signed JWT for BookNook readers)
export function authLoginHandler(req, res) {
  const { email, name } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required." });
  }

  const secret = process.env.JWT_SECRET || "booknook_jwt_super_secret_key_2026";
  const user = {
    id: "usr-" + Buffer.from(email).toString("hex").slice(0, 12),
    name: name || email.split("@")[0],
    email: email.toLowerCase(),
  };

  const token = jwt.sign(user, secret, { expiresIn: "7d" });

  res.json({
    success: true,
    message: "Authenticated successfully.",
    token,
    user,
  });
}

