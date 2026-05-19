require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDb = require("./config/db");
const User = require("./models/User");

async function seed() {
  await connectDb();

  const email = (
    process.env.SUPER_ADMIN_EMAIL ||
    process.env.SUPER_ADMIN_EMAILS?.split(",")[0] ||
    "rishukie@admin.in"
  ).trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || "12345678";
  const hashed = await bcrypt.hash(password, 12);

  await User.findOneAndUpdate(
    { email },
    {
      name: "Super Admin",
      email,
      password: hashed,
      role: "super_admin",
      adminScopes: [],
    },
    { upsert: true, returnDocument: "after" }
  );

  console.log(`Super Admin ready: ${email}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
