export type SidebarItem =
  | {
      type?: "link";
      label: string;
      href?: string;
      active?: boolean;
      icon?: string;
      disabled?: boolean;
      /** Generic semantic group identifier for related sidebar items. */
      groupId?: string;
    }
  | {
      type: "section";
      label: string;
      /** Generic semantic group identifier for related sidebar items. */
      groupId?: string;
    };
