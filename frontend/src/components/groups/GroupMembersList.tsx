import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase, Profile } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useLangStore } from '../../stores/langStore';
import { Avatar } from '../ui/Avatar';
import { GlassCard } from '../ui/GlassCard';

interface GroupMembersListProps {
  groupId: string;
  createdBy?: string | null;
}

export function GroupMembersList({ groupId, createdBy }: GroupMembersListProps) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const { t } = useLangStore();

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);
    supabase
      .from('group_members')
      .select('user_id, profiles(*)')
      .eq('group_id', groupId)
      .then(({ data }) => {
        const profiles = (data ?? [])
          .map((row: any) => row.profiles)
          .filter(Boolean) as Profile[];
        setMembers(profiles);
        setLoading(false);
      });
  }, [groupId]);

  if (loading) {
    return (
      <GlassCard className="p-4">
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-9 h-9 rounded-full bg-white/10" />
              <div className="h-3 bg-white/10 rounded w-28" />
            </div>
          ))}
        </div>
      </GlassCard>
    );
  }

  if (members.length === 0) {
    return (
      <GlassCard className="p-4 text-center text-text-muted text-sm">
        {t('noMembers')}
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4">
      <motion.div
        className="space-y-2"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
      >
        {members.map(member => {
          const isMe = member.id === user?.id;
          const isGroupAdmin = member.id === createdBy;
          return (
            <motion.div
              key={member.id}
              variants={{
                hidden: { opacity: 0, x: -16 },
                show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 100, damping: 18 } },
              }}
              className="flex items-center gap-3"
            >
              <Avatar src={member.avatar_url} name={member.username} size="md" />
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{member.username}</div>
                <div className="flex items-center gap-1.5">
                  {isMe && <span className="text-accent-green text-xs">You</span>}
                  {isGroupAdmin && (
                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-yellow-500/15 border border-yellow-500/25 text-yellow-400 font-medium">
                      Admin
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </GlassCard>
  );
}
