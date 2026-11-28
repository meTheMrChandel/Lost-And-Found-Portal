import { NavigatorScreenParams } from "@react-navigation/native";
import { MyReport } from "../api/posts";

export type AuthStackParamList = {
  Login: { email?: string } | undefined;
  Register: undefined;
  ForgotPassword: { email?: string } | undefined;
};

/** The bottom tabs. Staff see Admin where students see Activity (their reports). */
export type MainTabParamList = {
  Home: undefined;
  Activity: undefined;
  // The centre button: opens the "lost, found or scan" sheet instead of a screen
  Report: undefined;
  Inbox: undefined;
  Account: undefined;
  Admin: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;

  ItemDetail: { postId: string };
  ReportLost: undefined;
  // Prefilled when a finder comes from a QR sticker scan; qrUuid lets its owner be notified
  ReportFound: { title?: string; category?: string; qrUuid?: string } | undefined;
  // Set when the app is opened from a sticker link (lostandfound://scan/<uuid>)
  QRScan: { uuid?: string } | undefined;

  Chat: { conversationId: string; title?: string; draft?: string };
  NewMessage: undefined;
  Notifications: undefined;

  MyReports: undefined;
  // `report` shows the list's copy straight away while the full report loads
  MyReportDetail: { reportId: string; report?: MyReport };
  Valuables: undefined;
  RegisterValuable: undefined;
  EditProfile: undefined;
  // `from` names the screen the feedback was opened from
  Feedback: { from?: string } | undefined;

  // Admin console (campus admins only)
  AdminCases: { status?: string; slaBreached?: boolean; assignedToMe?: boolean } | undefined;
  AdminCaseDetail: { postId: string };
  AdminMatches: { status?: string } | undefined;
  AdminMatchDetail: { matchId: string };
  AdminAbuseReports: undefined;
  AdminUsers: undefined;
  AdminInvites: undefined;
  AdminAuditLog: { postId?: string; title?: string } | undefined;
  AdminFeedback: undefined;
  AdminSettings: undefined;
};

declare global {
  namespace ReactNavigation {
    // Typed useNavigation() everywhere
    interface RootParamList extends RootStackParamList {}
  }
}
