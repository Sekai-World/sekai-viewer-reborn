export type SidebarItem =
  | {
      type?: "link";
      label: string;
      href?: string;
      active?: boolean;
      icon?: string;
      disabled?: boolean;
      /** Links to another site: opens in a new window and shows an indicator icon. */
      external?: boolean;
      /** Generic semantic group identifier for related sidebar items. */
      groupId?: string;
    }
  | {
      type: "section";
      label: string;
      /** Generic semantic group identifier for related sidebar items. */
      groupId?: string;
    };
