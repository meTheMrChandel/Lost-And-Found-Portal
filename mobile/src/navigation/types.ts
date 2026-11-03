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
  ReportFound: { title?: string; category?: string } | undefined;
  // Set when the app is opened from a sticker link (lostandfound://scan/<uuid>)
  QRScan: { uuid?: string } | undefined;
  Valuables: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  ItemDetail: { postId: string };
  Chat: { conversationId: string; title?: string };
  Notifications: undefined;
  Valuables: undefined;
  MyReports: undefined;
  MyReportDetail: { report: MyReport };
  // `from` names the screen the feedback was opened from
  Feedback: { from?: string } | undefined;
};
