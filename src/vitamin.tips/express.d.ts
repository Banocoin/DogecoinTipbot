import { IAPIProject } from "../models/APIProject";

declare global {
   namespace Express {
      export interface Request {
         account?: IAPIProject
      }
   }
}