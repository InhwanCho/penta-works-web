import HospitalSettingsPage from "@/components/baselines/hospital-settings-page";
export default async function Page({params}:{params:Promise<{siteId:string}>}){const {siteId}=await params;return <HospitalSettingsPage siteId={siteId}/>;}
