import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Authentication token required.",
    });
  }

  const secret = process.env.JWT_SECRET || "booknook_jwt_super_secret_key_2026";

  jwt.verify(token, secret, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    req.user = decodedUser;
    next();
  });
}

// Optional Auth (For routes that work publicly but change behavior when token is present, like owner=me)
export function optionalAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    req.user = null;
    return next();
  }

  const secret = process.env.JWT_SECRET || "booknook_jwt_super_secret_key_2026";

  jwt.verify(token, secret, (err, decodedUser) => {
    if (!err) {
      req.user = decodedUser;
    } else {
      req.user = null;
    }
    next();
  });
}

