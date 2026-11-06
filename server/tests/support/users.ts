import bcrypt from "bcryptjs";
import { prisma } from "../../src/prisma.js";

// Test users are hashed with bcryptjs directly (cost 10, the NFR-01 minimum, to
// keep the suite fast) so these fixtures do not depend on the code under test.
export const TEST_PASSWORD = "Corr3ct-horse";

let counter = 0;

export async function createUser(role: "STUDENT" | "SUPERVISOR" = "STUDENT", password = TEST_PASSWORD) {
  counter += 1;
  return prisma().user.create({
    data: {
      email: `user${counter}-${Date.now()}@example.test`,
      name: `${role === "STUDENT" ? "Student" : "Supervisor"} ${counter}`,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
}
