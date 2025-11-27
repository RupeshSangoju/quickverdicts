const bcrypt = require("bcryptjs");

async function test() {
  const plainPassword = "Admin@123";
  const hash = "$2b$10$rQw8qBGE.bZxVN0YvKfYKeFDdJ3xF.3KxGxOWPYxXYKRvN2xqHJqS";
  
  const match = await bcrypt.compare(plainPassword, hash);
  console.log("Password matches:", match);
}

test();