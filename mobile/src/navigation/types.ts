import { NavigatorScreenParams } from "@react-navigation/native";
import { MyReport } from "../api/posts";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  ReportLost: undefined;
  // Prefilled when a finder comes from a QR sticker scan
  // qrUuid: set when the report starts from a scanned sticker, so its owner can be notified
  ReportFound: { title?: string; category?: string; qrUuid?: string } | undefined;
  // Set when the app is opened from a sticker link (lostandfound://scan/<uuid>)
  QRScan: { uuid?: string } | undefined;
  Valuables: undefined;
  Profile: undefined;
  // Only shown to campus admins (is_staff)
  Admin: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  ItemDetail: { postId: string };
  Chat: { conversationId: string; title?: string };
  Messages: undefined;
  Notifications: undefined;
  Valuables: undefined;
  MyReports: undefined;
  MyReportDetail: { report: MyReport };
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
