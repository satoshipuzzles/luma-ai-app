import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { AnimalKind } from '@/types/nostr';
import { formatPubkey } from '@/lib/nostr';
import { formatRelativeTime } from '@/lib/utils';

interface CommentSectionProps {
  comments: AnimalKind[];
  expanded?: boolean;
  highlightedCommentId?: string;
  onCommentClick?: (comment: AnimalKind) => void;
  className?: string;
}

export const CommentSection = ({ 
  comments, 
  expanded = false,
  highlightedCommentId,
  onCommentClick,
  className = ''
}: CommentSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [displayCount, setDisplayCount] = useState(3);
  const commentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedCommentId && commentRef.current) {
      setIsExpanded(true);
      setTimeout(() => {
        commentRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
      }, 100);
    }
  }, [highlightedCommentId]);

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 5);
  };

  if (comments.length === 0) {
    return (
      <div className={`text-center py-4 text-gray-400 ${className}`}>
        <MessageCircle className="w-6 h-6 mx-auto mb-2" />
        <p className="text-sm">No comments yet</p>
      </div>
    );
  }

  const sortedComments = [...comments].sort((a, b) => b.created_at - a.created_at);
  const displayedComments = isExpanded ? sortedComments.slice(0, displayCount) : sortedComments.slice(0, 1);
  const hasMore = isExpanded && displayCount < comments.length;

  return (
    <div className={`border-t border-gray-800 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-4 hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-sm font-medium flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          {comments.length} Comment{comments.length !== 1 ? 's' : ''}
        </span>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      
      {displayedComments.length > 0 && (
        <div className="p-4 space-y-4">
          {displayedComments.map((comment) => (
            <div
              key={comment.id}
              ref={comment.id === highlightedCommentId ? commentRef : null}
              onClick={() => onCommentClick?.(comment)}
              className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${
                comment.id === highlightedCommentId 
                  ? 'bg-purple-900/20' 
                  : 'hover:bg-gray-800/50 cursor-pointer'
              }`}
            >
              <img
                src="/default-avatar.png"
                alt="Commenter"
                className="w-8 h-8 rounded-full"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-sm text-gray-300 truncate">
                    {formatPubkey(comment.pubkey)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatRelativeTime(comment.created_at * 1000)}
                  </span>
                </div>
                <div className="text-sm text-gray-200 mt-1 break-words">
                  {comment.content}
                </div>
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              onClick={handleLoadMore}
              className="w-full py-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Load more comments...
            </button>
          )}
        </div>
      )}
    </div>
  );
};
