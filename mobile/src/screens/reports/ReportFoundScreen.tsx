import React from "react";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../navigation/types";
import { ReportForm } from "./ReportForm";

type Props = NativeStackScreenProps<RootStackParamList, "ReportFound">;

/** Opened from the Report sheet, or prefilled from a scanned QR sticker. */
export const ReportFoundScreen: React.FC<Props> = ({ route }) => (
  <ReportForm
    kind="found"
    initialTitle={route.params?.title}
    initialCategory={route.params?.category}
    qrUuid={route.params?.qrUuid}
  />
);
