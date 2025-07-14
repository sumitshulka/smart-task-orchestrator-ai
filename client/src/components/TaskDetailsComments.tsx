
import React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Props = {
  comment: string;
  setComment: (c: string) => void;
  handleComment: () => void;
};

const TaskDetailsComments: React.FC<Props> = ({
  comment,
  setComment,
  handleComment,
}) => (
  <div className="border-t pt-4 mt-6">
    <label className="block font-bold mb-1">Actions &amp; Comments</label>
    <div className="flex flex-col gap-3">
      <Textarea
        placeholder="Add comment or update made..."
        value={comment}
        onChange={e => setComment(e.target.value)}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={handleComment}
        disabled={!comment}
      >Add Comment</Button>
    </div>
  </div>
);

export default TaskDetailsComments;
