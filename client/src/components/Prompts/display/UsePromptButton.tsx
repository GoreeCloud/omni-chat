import { useState, useMemo, useCallback } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@librechat/client';
import type { TPromptGroup } from 'librechat-data-provider';
import { useLocalize, useSubmitMessage } from '~/hooks';
import { useRecordPromptUsage } from '~/data-provider';
import VariableDialog from '../dialogs/VariableDialog';
import { detectVariables } from '~/utils';

interface UsePromptButtonProps {
  group: TPromptGroup;
  /** The prompt text to submit or detect variables in: production text for a
   *  native group, resolved text for an externally managed one. This button
   *  does not resolve content itself; the caller supplies it. */
  promptText: string;
  /** True while the caller is still resolving `promptText` (e.g. a live
   *  Langfuse read); disables the button so a stale or empty value can't be
   *  submitted. */
  isLoading?: boolean;
  /** True when resolving `promptText` failed; disables the button, since a
   *  failed resolution must record no usage. */
  hasError?: boolean;
  onUsePrompt?: () => void;
}

const UsePromptButton = ({
  group,
  promptText,
  isLoading = false,
  hasError = false,
  onUsePrompt,
}: UsePromptButtonProps) => {
  const localize = useLocalize();
  const { submitPrompt } = useSubmitMessage();
  const { mutate: recordUsage } = useRecordPromptUsage();
  const [showVariableDialog, setShowVariableDialog] = useState(false);

  const hasVariables = useMemo(() => detectVariables(promptText), [promptText]);
  const disabled = isLoading || hasError || promptText.trim().length === 0;

  const handleUsePrompt = useCallback(() => {
    if (disabled) {
      return;
    }
    if (hasVariables) {
      setShowVariableDialog(true);
    } else {
      submitPrompt(promptText);
      if (group._id) {
        recordUsage(group._id);
      }
      onUsePrompt?.();
    }
  }, [disabled, hasVariables, submitPrompt, promptText, onUsePrompt, group._id, recordUsage]);

  const handleVariableDialogClose = useCallback(() => {
    setShowVariableDialog(false);
    onUsePrompt?.();
  }, [onUsePrompt]);

  return (
    <>
      <Button
        variant="submit"
        onClick={handleUsePrompt}
        disabled={disabled}
        className="flex-1 sm:min-w-40 sm:flex-none"
        aria-label={localize('com_ui_use_prompt')}
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {localize('com_ui_use_prompt')}
      </Button>

      <VariableDialog
        open={showVariableDialog}
        onClose={handleVariableDialogClose}
        group={group}
        promptText={promptText}
      />
    </>
  );
};

export default UsePromptButton;
