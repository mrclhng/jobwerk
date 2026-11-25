import type { Application } from "~/domain/application";
import type { Status } from "~/domain/status";

export type BoardApplication = Application;

export interface BoardActions {
  move: (app: BoardApplication, status: Status, grund?: string) => void;
  edit: (app: BoardApplication) => void;
}
