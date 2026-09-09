import adminUsersHandler from "../admin-users";

/**
 * Serverless Handler bridge for Vercel: /api/admin/users
 * Ensures direct Vercel routing if the nested path is invoked.
 */
export default async function handler(req: any, res: any) {
  return adminUsersHandler(req, res);
}
