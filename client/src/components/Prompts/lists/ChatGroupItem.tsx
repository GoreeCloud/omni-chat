import { useState, memo, useRef, useCallback, useEffect, useId, useMemo } from 'react';
import { useAtomValue } from 'jotai';
import * as Ariakit from '@ariakit/react';
import { Constants } from 'librechat-data-provider';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Ellipsis, Eye, SquarePen, Trash, EarthIcon, Cloud, User } from 'lucide-react';
import {
  Label,
  Button,
  Spinner,
  OGDialog,
  TooltipAnchor,
  DropdownPopup,
  OGDialogTemplate,
  useToastContext,
} from '@librechat/client';
import type { TPromptGroup } from 'librechat-data-provider';
import {
  cn,
  detectVariables,
  getPromptMutationErrorKey,
  getPromptGroupPermissions,
  getPromptResolveErrorMessage,
  getNewConversationDraftToken,
  rowActionClasses,
  rowActionSlotClasses,
} from '~/utils';
import { useLocalize, useAuthContext, useSubmitMessage, usePromptContentResolver } from '~/hooks';
import { useRecordPromptUsage, useDeletePromptGroup } from '~/data-provider';
import { useLiveAnnouncer, useChatContext } from '~/Providers';
import { navigationGenerationAtom } from '~/store/navigation';
import VariableDialog from '../dialogs/VariableDialog';
import PreviewPrompt from '../dialogs/PreviewPrompt';
import CategoryIcon from '../utils/CategoryIcon';

const PROMPT_PATH = '/prompts';

function ChatGroupItem({
  group,
  isChatRoute = true,
  permissionBits = 0,
}: {
  group: TPromptGroup;
  isChatRoute?: boolean;
  permissionBits?: number;
}) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const params = useParams();
  const { pathname } = useLocation();
  const { user } = useAuthContext();
  const { submitPrompt } = useSubmitMessage();
  const recordUsage = useRecordPromptUsage();
  const resolvePromptContent = usePromptContentResolver();
  const { announcePolite } = useLiveAnnouncer();
  const { conversation, index } = useChatContext();

  const { showToast } = useToastContext();
  const menuId = useId();
  const isSharedPrompt = group.author !== user?.id && Boolean(group.authorName);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPreviewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [isVariableDialogOpen, setVariableDialogOpen] = useState(false);
  const [variablePromptText, setVariablePromptText] = useState<string | undefined>(undefined);
  const [isResolving, setIsResolving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const mountedRef = useRef(true);
  const requestRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const conversationId = conversation?.conversationId;
  const navigationGeneration = useAtomValue(navigationGenerationAtom);
  /** A saved chat is identified by its id, so same-chat updates — streaming
   *  sync, pin or project changes, and parameter edits, all of which replace
   *  the conversation object — do not cancel an in-flight resolve. A draft
   *  chat keeps the id "new", so it is identified by the composer's draft
   *  token instead: `useNewConvo` renews that token on a new-chat reset and
   *  keeps it when the composer state is kept (for example, selecting an
   *  agent) or a parameter is edited. A resolve that was started for one
   *  chat must not land on another: bump the token so a pending
   *  continuation is discarded, and clear the spinner because its `finally`
   *  block will not run for the stale request.
   *
   *  `navigationGeneration` adds a second cancellation path: `navigateToConvo`
   *  resolves an uncached conversation by fetching its record before
   *  committing it, so `chatIdentity` only changes once the fetch settles
   *  and the user is moved. Keying the effect on the generation as well
   *  cancels a pending resolve the moment that navigation starts, rather
   *  than waiting for it to land.
   *
   *  `pathname` is a third cancellation key. A browser Back/Forward change
   *  (or any other route change) updates the URL directly; ChatRoute keeps
   *  the previous conversation mounted while the next one loads, so neither
   *  `chatIdentity` nor `navigationGeneration` changes yet. Keying on
   *  `pathname` cancels a pending resolve immediately, before the target
   *  conversation commits. A same-path re-navigation, such as a new-chat
   *  reset that lands back on `/c/new`, leaves the pathname unchanged and
   *  does not cancel. */
  const chatIdentity =
    conversationId === Constants.NEW_CONVO ? getNewConversationDraftToken(index) : conversationId;
  useEffect(() => {
    requestRef.current += 1;
    setIsResolving(false);
  }, [chatIdentity, navigationGeneration, pathname]);

  const groupIsGlobal = group.isPublic === true;
  const { isExternal, canEdit, canDelete } = getPromptGroupPermissions(group, permissionBits);

  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const deleteGroup = useDeletePromptGroup({
    onSuccess: () => {
      setDeleteOpen(false);
      announcePolite({
        message: localize('com_ui_prompt_deleted_group', { 0: group.name }),
        isStatus: true,
      });
      if (!isChatRoute && params.promptId === group._id) {
        navigate(PROMPT_PATH, { replace: true });
      }
    },
    onError: (error) => {
      showToast({
        status: 'error',
        message: localize(getPromptMutationErrorKey(error, 'com_ui_prompt_delete_error')),
      });
    },
  });

  const handleDelete = () => {
    if (!group._id) {
      return;
    }
    deleteGroup.mutate({ id: group._id });
  };

  const onCardClick = useCallback(async () => {
    if (!isChatRoute) {
      navigate(`${PROMPT_PATH}/${group._id}`, { replace: true });
      return;
    }

    if (isResolving) {
      return;
    }

    const token = ++requestRef.current;
    if (isExternal) {
      setIsResolving(true);
    }
    try {
      const text = await resolvePromptContent(group);
      /** The row may have unmounted, or the active conversation may have
       *  changed, while the Langfuse resolve was in flight; a stale
       *  continuation must not submit, stage, or record for a chat the
       *  user left. */
      if (!mountedRef.current || token !== requestRef.current) {
        return;
      }
      if (!text?.trim()) {
        return;
      }

      if (detectVariables(text)) {
        setVariablePromptText(text);
        setVariableDialogOpen(true);
        return;
      }

      submitPrompt(text);
      if (group._id) {
        recordUsage.mutate(group._id);
      }
    } catch (error) {
      if (mountedRef.current && token === requestRef.current) {
        showToast({ status: 'error', message: getPromptResolveErrorMessage(error, localize) });
      }
    } finally {
      if (isExternal && mountedRef.current && token === requestRef.current) {
        setIsResolving(false);
      }
    }
  }, [
    group,
    submitPrompt,
    recordUsage,
    isChatRoute,
    navigate,
    isResolving,
    isExternal,
    resolvePromptContent,
    showToast,
    localize,
  ]);

  const productionText = group.productionPrompt?.prompt ?? '';
  const hasOneliner = typeof group.oneliner === 'string' && group.oneliner.length > 0;
  let snippet = '';
  if (hasOneliner) {
    snippet = group.oneliner as string;
  } else if (productionText.length > 0) {
    snippet = productionText;
  } else if (isExternal) {
    snippet = localize('com_ui_prompt_source_langfuse');
  }

  const ariaLabel = group.category
    ? localize('com_ui_prompt_group_button', { name: group.name, category: group.category })
    : localize('com_ui_prompt_group_button_no_category', { name: group.name });

  const dropdownItems = useMemo(() => {
    const items = [
      {
        label: localize('com_ui_preview'),
        onClick: () => setPreviewDialogOpen(true),
        icon: <Eye className="icon-sm text-text-primary mr-2" aria-hidden="true" />,
      },
    ];
    if (canEdit) {
      items.push({
        label: localize('com_ui_edit'),
        onClick: () => navigate(`${PROMPT_PATH}/${group._id}`),
        icon: <SquarePen className="icon-sm text-text-primary mr-2" aria-hidden="true" />,
      });
    }
    if (canDelete) {
      items.push({
        label: localize('com_ui_delete'),
        onClick: () => setDeleteOpen(true),
        icon: <Trash className="icon-sm text-text-primary mr-2" aria-hidden="true" />,
      });
    }
    return items;
  }, [localize, canEdit, canDelete, group._id, navigate]);

  return (
    <>
      <div
        className={cn(
          'group relative mb-0.5 rounded-lg bg-transparent',
          !isChatRoute && params.promptId === group._id
            ? 'bg-surface-nav-selected'
            : 'hover:bg-surface-nav-hover',
        )}
        aria-busy={isResolving}
      >
        {/* Clickable overlay for card */}
        <button
          type="button"
          className="focus-visible:ring-ring-primary absolute inset-0 z-0 rounded-xl focus:outline-hidden focus-visible:ring-2"
          onClick={onCardClick}
          aria-label={ariaLabel}
          disabled={isResolving}
        />
        <div className="flex items-start gap-2.5 px-3 py-2.5">
          {isResolving ? (
            <Spinner className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <CategoryIcon
              category={group.category ?? ''}
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <TooltipAnchor
                description={group.name}
                side="top"
                render={
                  <span className="text-text-primary truncate text-sm font-medium">
                    {group.name}
                  </span>
                }
              />
              {isSharedPrompt && (
                <TooltipAnchor
                  description={localize('com_ui_by_author', { 0: group.authorName })}
                  side="top"
                  render={
                    <span
                      tabIndex={0}
                      role="img"
                      aria-label={localize('com_ui_by_author', { 0: group.authorName })}
                      className="flex shrink-0 items-center"
                    >
                      <User className="text-text-secondary size-3.5" aria-hidden="true" />
                    </span>
                  }
                />
              )}
              {groupIsGlobal && (
                <TooltipAnchor
                  description={localize('com_ui_sr_global_prompt')}
                  side="top"
                  render={
                    <span
                      tabIndex={0}
                      role="img"
                      aria-label={localize('com_ui_sr_global_prompt')}
                      className="flex shrink-0 items-center"
                    >
                      <EarthIcon className="text-accent-primary size-3.5" aria-hidden="true" />
                    </span>
                  }
                />
              )}
              {isExternal && (
                <TooltipAnchor
                  description={localize('com_ui_prompt_source_langfuse')}
                  side="top"
                  render={
                    <span
                      tabIndex={0}
                      role="img"
                      aria-label={localize('com_ui_prompt_source_langfuse')}
                      className="flex shrink-0 items-center"
                    >
                      <Cloud className="text-text-secondary size-3.5" aria-hidden="true" />
                    </span>
                  }
                />
              )}
              {/* The menu shares the title's line, so only the title gives way to it.
                  The snippet below keeps the full width of the row either way. */}
              <div
                className={cn(rowActionSlotClasses({ open: menuOpen }), 'relative z-10 ml-auto')}
              >
                <DropdownPopup
                  portal={true}
                  menuId={menuId}
                  focusLoop={true}
                  className="z-[125]"
                  unmountOnHide={true}
                  isOpen={menuOpen}
                  setIsOpen={setMenuOpen}
                  trigger={
                    <Ariakit.MenuButton
                      ref={menuButtonRef}
                      aria-label={localize('com_nav_convo_menu_options')}
                      className={rowActionClasses({ open: menuOpen })}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Ellipsis className="size-4" aria-hidden="true" />
                    </Ariakit.MenuButton>
                  }
                  items={dropdownItems}
                />
              </div>
            </div>
            <p className="text-text-secondary mt-0.5 line-clamp-2 text-xs leading-relaxed">
              {snippet}
            </p>
          </div>
        </div>
      </div>
      <PreviewPrompt
        group={group}
        open={isPreviewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        onCloseAutoFocus={() => {
          requestAnimationFrame(() => {
            menuButtonRef.current?.focus({ preventScroll: true });
          });
        }}
      />
      {isChatRoute && (
        <VariableDialog
          open={isVariableDialogOpen}
          onClose={() => setVariableDialogOpen(false)}
          group={group}
          promptText={variablePromptText}
        />
      )}
      <OGDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <OGDialogTemplate
          title={localize('com_ui_delete_prompt')}
          className="w-11/12 max-w-md"
          main={<Label>{localize('com_ui_prompt_delete_confirm', { 0: group.name })}</Label>}
          selection={
            <Button onClick={handleDelete} variant="destructive" disabled={deleteGroup.isLoading}>
              {deleteGroup.isLoading ? <Spinner /> : localize('com_ui_delete')}
            </Button>
          }
        />
      </OGDialog>
    </>
  );
}

export default memo(ChatGroupItem);
