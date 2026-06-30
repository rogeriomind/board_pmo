import { env } from "../config/env.js";
import {
  addChecklistItem,
  addComment,
  cancelActivity,
  createActivity,
  deleteChecklistItem,
  getActivityById,
  listActivities,
  listAlerts,
  listComments,
  listHistory,
  moveActivity,
  updateActivity,
  updateChecklistItem
} from "./activity.service.js";
import {
  addLocalChecklistItem,
  addLocalComment,
  cancelLocalActivity,
  createLocalActivity,
  deleteLocalChecklistItem,
  getLocalActivityById,
  listLocalActivities,
  listLocalAlerts,
  listLocalComments,
  listLocalHistory,
  moveLocalActivity,
  updateLocalActivity,
  updateLocalChecklistItem
} from "./localStore.service.js";

const local = env.DATA_DRIVER === "json";

export const activityRepository = {
  listActivities: local ? listLocalActivities : listActivities,
  getActivityById: local ? getLocalActivityById : getActivityById,
  createActivity: local ? createLocalActivity : createActivity,
  updateActivity: local ? updateLocalActivity : updateActivity,
  moveActivity: local ? moveLocalActivity : moveActivity,
  cancelActivity: local ? cancelLocalActivity : cancelActivity,
  addChecklistItem: local ? addLocalChecklistItem : addChecklistItem,
  updateChecklistItem: local ? updateLocalChecklistItem : updateChecklistItem,
  deleteChecklistItem: local ? deleteLocalChecklistItem : deleteChecklistItem,
  addComment: local ? addLocalComment : addComment,
  listComments: local ? listLocalComments : listComments,
  listHistory: local ? listLocalHistory : listHistory,
  listAlerts: local ? listLocalAlerts : listAlerts
};
