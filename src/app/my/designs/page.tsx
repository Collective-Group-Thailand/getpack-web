import { SiteHeader } from "@/components/Brand";
import MyDesigns from "./MyDesigns";

export const metadata = { title: "แบบของฉัน — BoxStudio" };

export default function Page() {
  return (
    <>
      <SiteHeader />
      <MyDesigns />
    </>
  );
}
