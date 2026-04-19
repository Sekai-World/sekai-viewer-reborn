export type SidebarItem =
  | {
      type?: "link";
      label: string;
      href?: string;
      active?: boolean;
      icon?: string;
      disabled?: boolean;
    }
  | {
      type: "section";
      label: string;
    };
