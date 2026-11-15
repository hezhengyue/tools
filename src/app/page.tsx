// src/app/page.tsx
import HomeSearch from "../components/HomeSearch";
import HomeCategories from "../components/HomeCategories";
import RecentBar from "../components/RecentBar";

export default function Home() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-12">
      <HomeSearch />
      <RecentBar />
      <HomeCategories />
    </div>
  );
}
