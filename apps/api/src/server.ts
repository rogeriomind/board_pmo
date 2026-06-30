import { env } from "./config/env.js";
import { app } from "./app.js";

app.listen(env.PORT, () => {
  console.log(`PMO Board API running at http://localhost:${env.PORT}`);
});
