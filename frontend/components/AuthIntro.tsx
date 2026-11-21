"use client";

import { useT } from "@/lib/i18n";
import BrandMark from "./BrandMark";
import Icon from "./Icon";

export default function AuthIntro() {
  const { pick } = useT();
  return <div className="auth-intro" aria-hidden="true">
    <BrandMark />
    <div className="auth-illustration"><span className="auth-orbit" /><Icon name="bag" /><span className="auth-spark auth-spark-one">✦</span><span className="auth-spark auth-spark-two">✦</span><span className="auth-mini"><Icon name="heart" filled /></span></div>
    <p>{pick("Your everyday, a little easier.", "ធ្វើឱ្យជីវិតប្រចាំថ្ងៃរបស់អ្នកកាន់តែងាយស្រួល។")}</p>
  </div>;
}
