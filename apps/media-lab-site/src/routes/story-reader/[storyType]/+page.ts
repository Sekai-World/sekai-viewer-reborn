import { error } from "@sveltejs/kit";
import { isPickerStoryType } from "$lib/story/story-picker";
import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => {
  if (!isPickerStoryType(params.storyType)) {
    error(404, "Unsupported story type");
  }
  return { storyType: params.storyType };
};
