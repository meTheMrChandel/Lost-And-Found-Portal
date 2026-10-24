import { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Feed: undefined;
  ReportLost: undefined;
  ReportFound: undefined;
  QRScan: undefined;
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
};
