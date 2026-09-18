/**
 * Live example. Needs TYPESAFE_API_KEY. Run: pnpm example:route "tu pregunta"
 */

import { routeCapability } from "@jev/capability-router";
import { TypeSafeClient } from "@jev/decide";

const question = process.argv.slice(2).join(" ") || "¿Qué SKUs de Isdin están sin stock en España?";
const client = new TypeSafeClient();
const route = await routeCapability(client, { question, scope: ["IB", "IT", "FR"] });
console.log(JSON.stringify(route, null, 2));
