import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Drawer,
  Grid,
  Layout,
  Menu,
  Segmented,
  Tooltip,
  Typography,
} from "antd";
import {
  AppstoreOutlined,
  CalendarOutlined,
  // TableOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
  SyncOutlined,
  TeamOutlined,
  BarsOutlined,
} from "@ant-design/icons";
import { useAdminTheme, type ThemeMode } from "../theme/adminThemeContext";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const menuItems = [
  {
    key: "/dashboard",
    icon: <AppstoreOutlined />,
    label: "Інформаційна панель",
  },
  {
    key: "/schedule",
    icon: <CalendarOutlined />,
    label: "Розклад",
  },
  {
    key: "/bookings",
    icon: <BarsOutlined />,
    label: "Бронювання",
  },
  { key: "/clients", icon: <TeamOutlined />, label: "Клієнти" },
  { key: "/contracts", icon: <FileTextOutlined />, label: "Контракти" },
  {
    key: "/posts",
    icon: <FileTextOutlined />,
    label: "Пости",
  },
];

function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const { isDark, mode, setMode } = useAdminTheme();
  const isMobile = !screens.md;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // const currentMenuItem = menuItems.find(
  //   (item) => item.key === location.pathname,
  // );
  const currentMenuItem = menuItems.find((item) =>
    location.pathname.startsWith(item.key),
  );
  const currentPageTitle = currentMenuItem?.label ?? "Адмінпанель KLR Service";

  const navigation = (
    <Menu
      mode="inline"
      theme={isDark ? "dark" : "light"}
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={({ key }) => {
        navigate(key);
        setIsMenuOpen(false);
      }}
    />
  );

  return (
    <Layout className="app-shell">
      {!isMobile && (
        <Sider
          width={248}
          theme={isDark ? "dark" : "light"}
          className="app-sidebar"
        >
          <div className="app-brand">
            <Title level={4} style={{ margin: 0 }}>
              KLR Service
            </Title>
          </div>

          {navigation}
        </Sider>
      )}

      <Drawer
        title="KLR Service"
        placement="left"
        width={288}
        open={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        {navigation}
      </Drawer>

      <Layout className="app-main">
        <Header className="app-header">
          {isMobile && (
            <Button
              aria-label="Відкрити меню"
              icon={<MenuOutlined />}
              onClick={() => setIsMenuOpen(true)}
            />
          )}

          <Title level={3} style={{ margin: 0 }}>
            {currentPageTitle}
          </Title>
          <Tooltip title="Тема інтерфейсу">
            <Segmented<ThemeMode>
              aria-label="Тема інтерфейсу"
              className="theme-mode-control"
              size="small"
              value={mode}
              onChange={setMode}
              options={[
                {
                  value: "light",
                  icon: <SunOutlined />,
                  title: "Світла",
                },
                {
                  value: "dark",
                  icon: <MoonOutlined />,
                  title: "Темна",
                },
                {
                  value: "system",
                  icon: <SyncOutlined />,
                  title: "Як у браузері",
                },
                {
                  value: "time",
                  icon: <ClockCircleOutlined />,
                  title: "За часом доби",
                },
              ]}
            />
          </Tooltip>
        </Header>

        <Content className="app-content">
          <section className="app-content-panel">
            <Outlet />
          </section>
        </Content>
      </Layout>
    </Layout>
  );
}

export default AdminLayout;
