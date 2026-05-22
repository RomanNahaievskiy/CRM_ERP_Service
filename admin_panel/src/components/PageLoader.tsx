import { Spin } from "antd";

type PageLoaderProps = {
  fullscreen?: boolean;
  label?: string;
};

function PageLoader({
  fullscreen = false,
  label = "Завантаження...",
}: PageLoaderProps) {
  return (
    <div className={fullscreen ? "page-loader page-loader_fullscreen" : "page-loader"}>
      <Spin size="large" />
      <span className="page-loader__label">{label}</span>
    </div>
  );
}

export default PageLoader;
