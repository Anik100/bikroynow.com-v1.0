'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import styles from './admin.module.css';
import { formatFullDate, formatPrice, compressImage, getRelativeTime } from '../../lib/utils';
import { uploadToImgBB } from '../../lib/imgbb';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Check, Trash2, ExternalLink, Star, LogOut, LayoutDashboard, Package, 
  Bell, Settings, Users, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Eye, Search, Shield,
  MessageSquare, Send, Camera
} from 'lucide-react';
import MembershipManager from './MembershipManager';

function toBengaliNumber(num, lang) {
  if (lang !== 'bn') return num;
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).split('').map(char => {
    const idx = englishDigits.indexOf(char);
    return idx !== -1 ? bengaliDigits[idx] : char;
  }).join('');
}

function getTranslatedPackageName(name, lang) {
  if (!name) return '';
  if (lang !== 'bn') return name;
  const lowerName = name.toLowerCase();
  const translations = {
    'free': 'ফ্রি',
    'silver member': 'সিলভার মেম্বার',
    'gold member': 'গোল্ড মেম্বার',
    'business member': 'বিজনেস মেম্বার'
  };

  if (translations[lowerName]) {
    return translations[lowerName];
  }

  // Dynamic regex translation: "X-Day Express/Premium/Mega Boost"
  const boostRegex = /^(\d+)-day\s+(express|premium|mega)\s+boost$/i;
  const match = lowerName.match(boostRegex);
  if (match) {
    const days = match[1];
    const type = match[2];
    const bnDays = toBengaliNumber(days, 'bn');
    
    let bnType = 'এক্সপ্রেস বুস্ট';
    if (type === 'premium') bnType = 'প্রিমিয়াম বুস্ট';
    if (type === 'mega') bnType = 'মেগা বুস্ট';

    return `${bnDays} দিনের ${bnType}`;
  }

  return name;
}

const ADMIN_EMAIL = 'anikh0000@gmail.com'; // Master Admin Email

export default function AdminDashboard() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('ads');
  const [adFilter, setAdFilter] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [moderatorInfo, setModeratorInfo] = useState(null);
  const [moderators, setModerators] = useState([]);
  const [modName, setModName] = useState('');
  const [modEmail, setModEmail] = useState('');
  const [modSections, setModSections] = useState({
    ads: true,
    memberships: true,
    gateways: true,
    payment_info: true,
    users: true,
    support: true,
  });
  const [modEditingEmail, setModEditingEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adsLoading, setAdsLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [listings, setListings] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

  // Restructured states
  const [purchases, setPurchases] = useState([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  // Featured Ads Board states
  const [featuredList, setFeaturedList] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);

  // Gateway Settings states
  const [bkashNum, setBkashNum] = useState('');
  const [bkashType, setBkashType] = useState('Personal');
  const [nagadNum, setNagadNum] = useState('');
  const [nagadType, setNagadType] = useState('Personal');
  const [savingSettings, setSavingSettings] = useState(false);

  // Live Support Settings & Chats states
  const [supportEmail, setSupportEmail] = useState('support@bikroyhut.com');
  const [supportWhatsapp, setSupportWhatsapp] = useState('8801700000000');
  const [supportWhatsappText, setSupportWhatsappText] = useState('Hello, I need help with BikroyHut!');
  const [supportLiveChatEnabled, setSupportLiveChatEnabled] = useState(true);
  const [supportHoursStart, setSupportHoursStart] = useState('00:00');
  const [supportHoursEnd, setSupportHoursEnd] = useState('23:59');
  const [savingSupportSettings, setSavingSupportSettings] = useState(false);

  const [supportChats, setSupportChats] = useState([]);
  const [selectedSupportChat, setSelectedSupportChat] = useState(null);
  const [supportMessages, setSupportMessages] = useState([]);
  const [newSupportMessage, setNewSupportMessage] = useState('');
  const [sendingSupportMsg, setSendingSupportMsg] = useState(false);
  const [activeUsers, setActiveUsers] = useState(new Set());
  const [totalUnreadSupport, setTotalUnreadSupport] = useState(0);
  const [filterUnreadSupport, setFilterUnreadSupport] = useState(false);
  const messagesEndRef = useRef(null);
  const adminSupportInputRef = useRef(null);
  const adminSupportMessagesRef = useRef(null);

  // Real-time Global Presence Subscription for Support Chats
  useEffect(() => {
    if (!isAdmin) return;
    
    const presenceChannel = supabase.channel('support_hub_presence');
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const users = new Set();
        Object.values(state).forEach(presences => {
          presences.forEach(p => {
            if (p.isUser) users.add(p.user_id);
          });
        });
        setActiveUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ isUser: false, isSupportAgent: true, timestamp: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [isAdmin]);

  // Real-time Global message subscription for Admin
  useEffect(() => {
    if (!isAdmin) return;

    const globalMsgSub = supabase
      .channel('admin_global_support_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'support_messages',
      }, (payload) => {
        // Refresh chat list to get new unread counts and latest messages
        fetchSupportChats();
        
        // If the new message belongs to the currently open chat, append it!
        if (selectedSupportChat && payload.new.support_chat_id === selectedSupportChat.id) {
          const isUserMsg = payload.new.sender_id === selectedSupportChat.user_id;
          
          // If message is from the user, mark as read immediately since admin is active in this room
          if (isUserMsg && !payload.new.is_read) {
            supabase
              .from('support_messages')
              .update({ is_read: true })
              .eq('id', payload.new.id)
              .then(() => {
                fetchSupportChats();
              });
          }

          const localMsg = isUserMsg ? { ...payload.new, is_read: true } : payload.new;
          setSupportMessages(prev => {
            if (prev.some(m => m.id === localMsg.id)) return prev;
            return [...prev, localMsg];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(globalMsgSub);
    };
  }, [isAdmin, selectedSupportChat]);

  // Scroll to bottom on new messages (Admin view)
  useEffect(() => {
    if (adminSupportMessagesRef.current) {
      adminSupportMessagesRef.current.scrollTop = adminSupportMessagesRef.current.scrollHeight;
    }
  }, [supportMessages]);

  // User Management states
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(null); // { id, email, membership_type, membership_expires_at }
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [purchaseFilter, setPurchaseFilter] = useState('pending');

  const getPurchaseFilterBtnStyle = (isActive, activeColor) => ({
    background: isActive ? activeColor : 'white',
    color: isActive ? 'white' : '#475569',
    border: `1px solid ${isActive ? activeColor : '#cbd5e1'}`,
    borderRadius: '6px',
    padding: '0.3rem 0.7rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none'
  });

  // Restore the selected tab on page reload
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('admin_active_tab');
      if (savedTab) {
        setActiveTab(savedTab);
        if (savedTab === 'featured_ads') {
          fetchFeaturedList();
        }
      }
    }
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_active_tab', tab);
    }
    if (tab === 'users') {
      fetchProfiles();
    } else if (tab === 'support') {
      fetchSupportChats();
      fetchSettings();
    } else if (tab === 'featured_ads') {
      fetchFeaturedList();
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const authorizeUser = (userEmail) => {
        return new Promise(async (resolve) => {
          try {
            const { data: settingsData } = await supabase.from('admin_settings').select('*');
            let modsList = [];
            if (settingsData) {
              const modsVal = settingsData.find(s => s.key === 'moderators')?.value;
              if (modsVal) {
                try {
                  modsList = JSON.parse(modsVal);
                } catch (e) {}
              }
            }
            
            const isMasterAdmin = userEmail === ADMIN_EMAIL;
            const matchingMod = modsList.find(m => m.email === userEmail);
            
            if (isMasterAdmin || matchingMod) {
              resolve({ authorized: true, isMasterAdmin, matchingMod });
            } else {
              resolve({ authorized: false });
            }
          } catch (err) {
            resolve({ authorized: userEmail === ADMIN_EMAIL, isMasterAdmin: userEmail === ADMIN_EMAIL });
          }
        });
      };

      if (session) {
        const { authorized, isMasterAdmin, matchingMod } = await authorizeUser(session.user.email);
        if (authorized) {
          if (isMounted) {
            setIsAdmin(true);
            setIsModerator(!isMasterAdmin);
            setModeratorInfo(matchingMod || null);
            
            if (matchingMod) {
              const allowed = matchingMod.allowed_sections || [];
              if (allowed.length > 0) {
                setActiveTab(allowed[0]);
              }
            }

            fetchListings();
            fetchPurchases();
            fetchSettings();
            fetchSupportChats();
            fetchFeaturedList();
          }
        } else {
          router.push('/');
        }
      } else {
        setTimeout(async () => {
          if (!isMounted) return;
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession) {
            const { authorized, isMasterAdmin, matchingMod } = await authorizeUser(retrySession.user.email);
            if (authorized) {
              if (isMounted) {
                setIsAdmin(true);
                setIsModerator(!isMasterAdmin);
                setModeratorInfo(matchingMod || null);
                
                if (matchingMod) {
                  const allowed = matchingMod.allowed_sections || [];
                  if (allowed.length > 0) {
                    setActiveTab(allowed[0]);
                  }
                }

                fetchListings();
                fetchPurchases();
                fetchSettings();
                fetchSupportChats();
                fetchFeaturedList();
              }
            } else {
              router.push('/');
            }
          } else {
            router.push('/');
          }
        }, 1200);
      }
    };
    
    checkAdmin();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const fetchListings = async () => {
    setAdsLoading(true);
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (data) setListings(data);
    setAdsLoading(false);
    setLoading(false);
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const { data } = await supabase.from('admin_settings').select('*');
      if (data) {
        const bkash = data.find(s => s.key === 'bkash_number');
        const bkType = data.find(s => s.key === 'bkash_type');
        const nagad = data.find(s => s.key === 'nagad_number');
        const ngType = data.find(s => s.key === 'nagad_type');
        if (bkash) setBkashNum(bkash.value);
        if (bkType) setBkashType(bkType.value);
        if (nagad) setNagadNum(nagad.value);
        if (ngType) setNagadType(ngType.value);

        const mods = data.find(s => s.key === 'moderators');
        if (mods && mods.value) {
          try {
            setModerators(JSON.parse(mods.value));
          } catch (e) {
            console.error('Error parsing moderators:', e);
          }
        }

        const supportVal = data.find(s => s.key === 'support_settings')?.value;
        if (supportVal) {
          try {
            const parsed = JSON.parse(supportVal);
            if (parsed.email) setSupportEmail(parsed.email);
            if (parsed.whatsapp) setSupportWhatsapp(parsed.whatsapp);
            if (parsed.whatsapp_text) setSupportWhatsappText(parsed.whatsapp_text);
            if (parsed.live_chat_enabled !== undefined) setSupportLiveChatEnabled(parsed.live_chat_enabled);
            if (parsed.support_hours_start) setSupportHoursStart(parsed.support_hours_start);
            if (parsed.support_hours_end) setSupportHoursEnd(parsed.support_hours_end);
          } catch (e) {
            console.error('Error parsing support settings:', e);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching admin settings:', err);
    }
    setSettingsLoading(false);
  };

  const fetchSupportChats = async () => {
    try {
      const { data, error } = await supabase
        .from('support_chats')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error || !data) return;

      const enriched = (await Promise.all(data.map(async (chat) => {
        try {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url')
            .eq('id', chat.user_id)
            .maybeSingle();

          const { data: messages } = await supabase
            .from('support_messages')
            .select('content, created_at, is_read, sender_id')
            .eq('support_chat_id', chat.id)
            .order('created_at', { ascending: false });
            
          const lastMsg = messages?.[0] || null;
          if (lastMsg && lastMsg.sender_id !== chat.user_id) {
            const diffMins = (new Date().getTime() - new Date(lastMsg.created_at).getTime()) / (1000 * 60);
            if (diffMins >= 30) {
              supabase.from('support_chats').delete().eq('id', chat.id).then(() => {});
              return null;
            }
          }
            
          const isChatActive = selectedSupportChat && selectedSupportChat.id === chat.id;
          const unreadCount = isChatActive
            ? 0
            : (messages?.filter(m => m.sender_id === chat.user_id && !m.is_read).length || 0);

          return {
            ...chat,
            user: userProfile || { full_name: 'Unknown User', email: 'N/A' },
            lastMsg,
            unreadCount
          };
        } catch (innerErr) {
          console.error(`Error enriching support chat ${chat.id}:`, innerErr);
          return null;
        }
      }))).filter(Boolean);

      // Sort in frontend to ensure latest message is at the top
      enriched.sort((a, b) => {
        const timeA = a.lastMsg ? new Date(a.lastMsg.created_at).getTime() : new Date(a.created_at).getTime();
        const timeB = b.lastMsg ? new Date(b.lastMsg.created_at).getTime() : new Date(b.created_at).getTime();
        return timeB - timeA;
      });

      const totalUnread = enriched.reduce((sum, chat) => sum + chat.unreadCount, 0);
      setTotalUnreadSupport(totalUnread);
      setSupportChats(enriched);
    } catch (err) {
      console.error('Error fetching support chats:', err);
    }
  };

  const handleSelectSupportChat = async (chat) => {
    setSelectedSupportChat(chat);

    // Optimistic Update: Immediately clear unread status for the clicked chat in state
    if (chat.unreadCount > 0) {
      setSupportChats(prevChats => 
        prevChats.map(c => 
          c.id === chat.id 
            ? { ...c, unreadCount: 0 } 
            : c
        )
      );
      setTotalUnreadSupport(prevTotal => Math.max(0, prevTotal - chat.unreadCount));
    }

    try {
      if (chat.unreadCount > 0) {
        // Run update in background and quietly fetch chats upon completion
        supabase
          .from('support_messages')
          .update({ is_read: true })
          .eq('support_chat_id', chat.id)
          .eq('sender_id', chat.user_id)
          .eq('is_read', false)
          .then(() => {
            fetchSupportChats();
          });
      }

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('support_messages')
        .select('*')
        .eq('support_chat_id', chat.id)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: true });

      setSupportMessages(data || []);
      setTimeout(() => {
        adminSupportInputRef.current?.focus();
      }, 100);
    } catch (err) {
      console.error('Error fetching support messages:', err);
    }
  };

  const handleSendSupportMsg = async (e, imageUrl = null) => {
    if (e) e.preventDefault();
    if ((!newSupportMessage.trim() && !imageUrl) || !selectedSupportChat) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setSendingSupportMsg(true);
    const content = newSupportMessage;
    setNewSupportMessage('');

    const { error } = await supabase
      .from('support_messages')
      .insert({
        support_chat_id: selectedSupportChat.id,
        sender_id: session.user.id,
        content: content || null,
        image_url: imageUrl || null
      });

    if (error) {
      if (!imageUrl) setNewSupportMessage(content);
      alert('Failed to send message: ' + error.message);
    } else {
      await supabase
        .from('support_chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedSupportChat.id);
        
      fetchSupportChats();
    }
    setSendingSupportMsg(false);
    setTimeout(() => {
      adminSupportInputRef.current?.focus();
    }, 50);
  };

  const handleAdminSupportImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSendingSupportMsg(true);
    try {
      const compressed = await compressImage(file);
      const url = await uploadToImgBB(compressed);
      await handleSendSupportMsg(null, url);
    } catch (err) {
      alert('Failed to upload attachment: ' + err.message);
    }
    setSendingSupportMsg(false);
  };

  const executeEndChat = async () => {
    if (!selectedSupportChat) return;
    setSendingSupportMsg(true);
    try {
      // 1. Delete all support messages associated with the chat room
      const { error: msgErr } = await supabase
        .from('support_messages')
        .delete()
        .eq('support_chat_id', selectedSupportChat.id);

      if (msgErr) throw msgErr;

      // 2. Delete the support chat room itself
      const { error: chatErr } = await supabase
        .from('support_chats')
        .delete()
        .eq('id', selectedSupportChat.id);

      if (chatErr) throw chatErr;

      // 3. Clear states
      setSelectedSupportChat(null);
      setSupportMessages([]);
      
      // 4. Refresh chats list
      fetchSupportChats();

      setErrorMessage(lang === 'bn' ? '✓ সফলভাবে চ্যাট সেশনটি বন্ধ এবং সমস্ত ডাটা মুছে ফেলা হয়েছে।' : '✓ Support chat session ended and all data deleted successfully.');
    } catch (err) {
      console.error('Error ending support chat:', err);
      setErrorMessage(lang === 'bn' ? '✗ চ্যাট শেষ করতে সমস্যা হয়েছে: ' + err.message : '✗ Error ending support chat: ' + err.message);
    } finally {
      setSendingSupportMsg(false);
    }
  };

  const handleAdminEndChat = () => {
    if (!selectedSupportChat) return;

    // Destructive action: Single warning modal
    confirmAction(
      'চ্যাট সেশনটি শেষ করতে চান?', 'End Support Session?',
      'আপনি কি নিশ্চিত? এই সেশনের সমস্ত মেসেজ ও ডাটা চিরতরে মুছে ফেলা হবে।', 'Are you sure? All messages and session data will be permanently deleted.',
      executeEndChat,
      true // isDestructive = true
    );
  };

  const handleSaveSupportSettings = async () => {
    setSavingSupportSettings(true);
    try {
      const config = {
        email: supportEmail,
        whatsapp: supportWhatsapp,
        whatsapp_text: supportWhatsappText,
        live_chat_enabled: supportLiveChatEnabled,
        support_hours_start: supportHoursStart,
        support_hours_end: supportHoursEnd
      };

      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key: 'support_settings', value: JSON.stringify(config) });

      if (error) {
        setErrorMessage('Error saving support settings: ' + error.message);
      } else {
        setErrorMessage('⚙️ Support settings updated successfully!');
      }
    } catch (err) {
      setErrorMessage('Exception saving settings: ' + err.message);
    }
    setSavingSupportSettings(false);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const { error: e1 } = await supabase
        .from('admin_settings')
        .upsert({ key: 'bkash_number', value: bkashNum });
      const { error: e2 } = await supabase
        .from('admin_settings')
        .upsert({ key: 'bkash_type', value: bkashType });
      const { error: e3 } = await supabase
        .from('admin_settings')
        .upsert({ key: 'nagad_number', value: nagadNum });
      const { error: e4 } = await supabase
        .from('admin_settings')
        .upsert({ key: 'nagad_type', value: nagadType });

      if (!e1 && !e2 && !e3 && !e4) {
        setErrorMessage('⚙️ Gateway settings updated successfully!');
      } else {
        setErrorMessage('Error saving payment settings');
      }
    } catch (err) {
      setErrorMessage('Exception: ' + err.message);
    }
    setSavingSettings(false);
  };

  const saveModeratorsList = async (list) => {
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key: 'moderators', value: JSON.stringify(list) });
      if (error) {
        setErrorMessage('Error saving moderators: ' + error.message);
      }
    } catch (err) {
      setErrorMessage('Exception saving moderators: ' + err.message);
    }
  };

  const handleAddModerator = async (e) => {
    e.preventDefault();
    if (!modName || !modEmail) return;

    const sectionsList = Object.keys(modSections).filter(k => modSections[k]);
    const newModerators = [...moderators];
    
    if (modEditingEmail) {
      const idx = newModerators.findIndex(m => m.email === modEditingEmail);
      if (idx !== -1) {
        newModerators[idx] = { name: modName, email: modEmail, allowed_sections: sectionsList };
      }
      setModEditingEmail(null);
    } else {
      if (newModerators.some(m => m.email === modEmail)) {
        setErrorMessage('Moderator with this email already exists!');
        return;
      }
      newModerators.push({ name: modName, email: modEmail, allowed_sections: sectionsList });
    }

    setModerators(newModerators);
    await saveModeratorsList(newModerators);

    setModName('');
    setModEmail('');
    setModSections({
      ads: true,
      memberships: true,
      gateways: true,
      payment_info: true,
      users: true,
      support: true,
    });
  };

  const handleEditModeratorClick = (mod) => {
    setModEditingEmail(mod.email);
    setModName(mod.name);
    setModEmail(mod.email);
    const sectionsObj = {
      ads: mod.allowed_sections.includes('ads'),
      memberships: mod.allowed_sections.includes('memberships'),
      gateways: mod.allowed_sections.includes('gateways'),
      payment_info: mod.allowed_sections.includes('payment_info'),
      users: mod.allowed_sections.includes('users'),
      support: mod.allowed_sections.includes('support'),
    };
    setModSections(sectionsObj);
  };

  const handleDeleteModerator = async (email) => {
    const newModerators = moderators.filter(m => m.email !== email);
    setModerators(newModerators);
    await saveModeratorsList(newModerators);
  };

  const fetchPurchases = async () => {
    setPurchasesLoading(true);
    try {
      // FIFO Order: Oldest Pending Request first
      const { data } = await supabase
        .from('membership_purchases')
        .select('*')
        .order('created_at', { ascending: true });
      if (data) setPurchases(data);
    } catch (err) {
      console.error('Error fetching purchases:', err);
    }
    setPurchasesLoading(false);
  };

  const fetchProfiles = async () => {
    setProfilesLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('email', { ascending: true });
      
      if (data) {
        const now = new Date();
        const updatedProfiles = [...data];
        
        for (let i = 0; i < updatedProfiles.length; i++) {
          const u = updatedProfiles[i];
          if (u.membership_expires_at && new Date(u.membership_expires_at) < now) {
            // Automatically reset expired membership in Supabase database
            await supabase
              .from('profiles')
              .update({
                membership_type: 'free',
                membership_expires_at: null
              })
              .eq('id', u.id);
            
            // Sync local profile object
            updatedProfiles[i] = {
              ...u,
              membership_type: 'free',
              membership_expires_at: null
            };
          }
        }
        setProfiles(updatedProfiles);
      }
    } catch (err) {
      console.error('Error fetching profiles:', err);
    }
    setProfilesLoading(false);
  };

  const handleUpdateManualMembership = async (profileId, type, expiresAtStr) => {
    try {
      const updates = {
        membership_type: type,
        membership_expires_at: expiresAtStr ? new Date(expiresAtStr).toISOString() : null
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profileId);

      if (!error) {
        setErrorMessage(lang === 'bn' ? '👤 ইউজার মেম্বারশিপ স্ট্যাটাস সফলভাবে আপডেট করা হয়েছে!' : '👤 User membership status updated successfully!');
        setEditingProfile(null);
        fetchProfiles();
      } else {
        setErrorMessage('Error updating profile: ' + error.message);
      }
    } catch (err) {
      setErrorMessage('Exception: ' + err.message);
    }
  };

  const fetchFeaturedList = async () => {
    setFeaturedLoading(true);
    try {
      const { data, error } = await supabase
        .from('featured_ads')
        .select(`
          *,
          listing:listing_id (
            id, title, price, location, images, user_id, status
          )
        `)
        .order('sort_order', { ascending: true });

      if (data && !error) {
        setFeaturedList(data);
      }
    } catch (err) {
      console.error('Error fetching featured ads list in admin:', err);
    }
    setFeaturedLoading(false);
  };

  const handleToggleFeaturedActive = async (id, currentVal) => {
    try {
      const { error } = await supabase
        .from('featured_ads')
        .update({ is_active: !currentVal })
        .eq('id', id);

      if (!error) {
        setFeaturedList(prev => prev.map(item => item.id === id ? { ...item, is_active: !currentVal } : item));
        setErrorMessage(lang === 'bn' ? '✓ স্ট্যাটাস সফলভাবে পরিবর্তন করা হয়েছে!' : '✓ Status successfully updated!');
      } else {
        setErrorMessage('Error toggling featured ad: ' + error.message);
      }
    } catch (err) {
      setErrorMessage('Exception: ' + err.message);
    }
  };

  const handleDeleteFeatured = async (id) => {
    try {
      const { error } = await supabase
        .from('featured_ads')
        .delete()
        .eq('id', id);

      if (!error) {
        setFeaturedList(prev => prev.filter(item => item.id !== id));
        setErrorMessage(lang === 'bn' ? '✓ ফিচার্ড লিস্ট থেকে সরানো হয়েছে!' : '✓ Removed from featured list!');
      } else {
        setErrorMessage('Error removing featured ad: ' + error.message);
      }
    } catch (err) {
      setErrorMessage('Exception: ' + err.message);
    }
  };

  const handleAddManualFeatured = async (listingId) => {
    if (!listingId) return;
    try {
      const nextSort = featuredList.length > 0 ? Math.max(...featuredList.map(item => item.sort_order || 0)) + 1 : 0;
      
      const { data, error } = await supabase
        .from('featured_ads')
        .upsert({ listing_id: listingId, is_active: true, sort_order: nextSort }, { onConflict: 'listing_id' })
        .select(`
          *,
          listing:listing_id (
            id, title, price, location, images, user_id, status
          )
        `);

      if (!error && data && data.length > 0) {
        setErrorMessage(lang === 'bn' ? '✓ সফলভাবে বিজ্ঞাপনটি ফিচার করা হয়েছে!' : '✓ Ad successfully featured!');
        fetchFeaturedList();
      } else {
        setErrorMessage(error ? 'Error featuring ad: ' + error.message : 'Already exists or error adding.');
      }
    } catch (err) {
      setErrorMessage('Exception: ' + err.message);
    }
  };

  const handlePurchaseStatus = async (id, status) => {
    try {
      if (status === 'approved') {
        const { data: purchase, error: fetchErr } = await supabase
          .from('membership_purchases')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchErr || !purchase) {
          throw new Error('Could not retrieve purchase request');
        }

        const { data: pkg, error: pkgErr } = await supabase
          .from('membership_packages')
          .select('*')
          .eq('id', purchase.package_id)
          .single();

        if (pkgErr || !pkg) {
          throw new Error('Could not retrieve package details');
        }

        if (pkg.type === 'membership') {
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', purchase.user_email.trim())
            .single();

          if (profileErr || !profile) {
            throw new Error(`Profile with email ${purchase.user_email} not found`);
          }

          const expiresAt = new Date();
          if (pkg.duration_unit === 'month') {
            expiresAt.setMonth(expiresAt.getMonth() + (pkg.duration || 1));
          } else if (pkg.duration_unit === 'days') {
            expiresAt.setDate(expiresAt.getDate() + (pkg.duration || 30));
          } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          }

          const { error: profileUpdateErr } = await supabase
            .from('profiles')
            .update({
              membership_type: pkg.name_en,
              membership_expires_at: expiresAt.toISOString()
            })
            .eq('id', profile.id);

          if (profileUpdateErr) {
            throw profileUpdateErr;
          }

          // Automatically add Business Member's active listings to featured_ads
          if (pkg.color?.toLowerCase() === 'business' || pkg.name_en?.toLowerCase().includes('business')) {
            const { data: userListings } = await supabase
              .from('listings')
              .select('id')
              .eq('user_id', profile.id)
              .eq('status', 'active');

            if (userListings && userListings.length > 0) {
              const featuredInserts = userListings.map((lst, idx) => ({
                listing_id: lst.id,
                is_active: true,
                sort_order: idx
              }));

              const { error: featErr } = await supabase
                .from('featured_ads')
                .upsert(featuredInserts, { onConflict: 'listing_id' });

              if (featErr) {
                console.error('Error inserting business featured ads:', featErr);
              }
            }
          }
        } else if (pkg.type === 'boost') {
          // AUTOMATED BOOSTING! Bumps date, adds tag, sets verified
          if (purchase.listing_id) {
            const { error: listingUpdateErr } = await supabase
              .from('listings')
              .update({
                is_verified: true,
                promotion_type: pkg.name_en,
                created_at: new Date().toISOString()
              })
              .eq('id', purchase.listing_id);

            if (listingUpdateErr) {
              throw listingUpdateErr;
            }
          }

          // ALSO update user's profile with the boost tag and expiry!
          const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', purchase.user_email.trim())
            .single();

          if (!profileErr && profile) {
            const expiresAt = new Date();
            if (pkg.duration_unit === 'month') {
              expiresAt.setMonth(expiresAt.getMonth() + (pkg.duration || 1));
            } else if (pkg.duration_unit === 'days') {
              expiresAt.setDate(expiresAt.getDate() + (pkg.duration || 3));
            } else {
              expiresAt.setDate(expiresAt.getDate() + 3); // Default to 3 days
            }

            const { error: profileUpdateErr } = await supabase
              .from('profiles')
              .update({
                membership_type: pkg.name_en,
                membership_expires_at: expiresAt.toISOString()
              })
              .eq('id', profile.id);

            if (profileUpdateErr) {
              console.error('Error updating profile for boost:', profileUpdateErr);
            }
          }
        }
      } else if (status === 'rejected') {
        const { data: purchase } = await supabase
          .from('membership_purchases')
          .select('*')
          .eq('id', id)
          .single();

        if (purchase) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', purchase.user_email.trim())
            .single();

          if (profile) {
            await supabase
              .from('profiles')
              .update({
                membership_type: 'free',
                membership_expires_at: null
              })
              .eq('id', profile.id);
          }
        }
      }

      const { error } = await supabase
        .from('membership_purchases')
        .update({ status })
        .eq('id', id);

      if (!error) {
        setErrorMessage(lang === 'bn' ? `অনুরোধটি সফলভাবে ${status === 'approved' ? 'অনুমোদিত' : 'প্রত্যাখ্যাত'} করা হয়েছে!` : `Request marked as ${status.toUpperCase()}!`);
        fetchPurchases();
        fetchListings(); // Refresh active feeds
        fetchProfiles(); // Re-fetch profiles so User Memberships tab is in sync!
      } else {
        setErrorMessage('Error updating request status: ' + error.message);
      }
    } catch (err) {
      setErrorMessage('Exception: ' + err.message);
    }
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      const currentTime = new Date().toISOString();
      const { error } = await supabase
        .from('listings')
        .update({ 
          status: 'active',
          created_at: currentTime 
        })
        .eq('id', id);
        
      if (!error) {
        setListings(prev => {
          const updated = prev.map(ad => ad.id === id ? { ...ad, status: 'active', created_at: currentTime } : ad);
          return updated.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        });

        // Automatically insert to featured_ads if owner is an active Business Member
        try {
          const { data: listingData } = await supabase
            .from('listings')
            .select('user_id')
            .eq('id', id)
            .single();
          
          if (listingData) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('membership_type, membership_expires_at')
              .eq('id', listingData.user_id)
              .single();
            
            if (profile) {
              const expiresAt = profile.membership_expires_at ? new Date(profile.membership_expires_at) : null;
              const isNotExpired = !expiresAt || new Date() < expiresAt;
              const isBusiness = profile.membership_type && profile.membership_type.toLowerCase().includes('business');
              
              if (isBusiness && isNotExpired) {
                await supabase
                  .from('featured_ads')
                  .upsert({ listing_id: id, is_active: true, sort_order: 0 }, { onConflict: 'listing_id' });
              }
            }
          }
        } catch (featErr) {
          console.error('Error automatically featuring approved business ad:', featErr);
        }
      } else {
        setErrorMessage('Error approving ad: ' + error.message);
      }
    } catch (err) {
      setErrorMessage('Exception: ' + err.message);
    }
    setActionLoading(null);
  };

  const [confirmDialog, setConfirmDialog] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const confirmAction = (titleBn, titleEn, messageBn, messageEn, onConfirm, isDestructive = false) => {
    setConfirmDialog({
      title: lang === 'bn' ? titleBn : titleEn,
      message: lang === 'bn' ? messageBn : messageEn,
      onConfirm,
      isDestructive
    });
  };

  const confirmDelete = (id) => {
    confirmAction(
      'বিজ্ঞাপনটি মুছে ফেলবেন?', 'Delete Ad?',
      'এই বিজ্ঞাপনটি স্থায়ীভাবে মুছে ফেলা হবে।', 'This ad will be permanently deleted.',
      () => handleDelete(id),
      true
    );
  };

  const handleDelete = async (id) => {
    if (!id) return;
    
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', id);
        
      if (!error) {
        setListings(prev => prev.filter(ad => ad.id !== id));
      } else {
        setErrorMessage('Error deleting ad: ' + error.message);
      }
    } catch (err) {
      setErrorMessage('Exception: ' + err.message);
    }
    setActionLoading(null);
  };

  const confirmReject = (id) => {
    confirmAction(
      'বিজ্ঞাপনটি বাতিল (Reject) করবেন?', 'Reject Ad?',
      'এই বিজ্ঞাপনটি বাতিল করা হবে।', 'This ad will be rejected and moved to the Rejected tab.',
      () => handleReject(id),
      true
    );
  };

  const handleReject = async (id) => {
    if (!id) return;
    
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('listings')
        .update({ status: 'rejected' })
        .eq('id', id);
        
      if (!error) {
        setListings(prev => {
          const updated = prev.map(ad => ad.id === id ? { ...ad, status: 'rejected' } : ad);
          return updated;
        });
      } else {
        setErrorMessage('Error rejecting ad: ' + error.message);
      }
    } catch (err) {
      setErrorMessage('Exception: ' + err.message);
    }
    setActionLoading(null);
  };

  const handleRestore = async (id) => {
    if (!id) return;
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('listings')
        .update({ status: 'pending' })
        .eq('id', id);
        
      if (!error) {
        setListings(prev => {
          const updated = prev.map(ad => ad.id === id ? { ...ad, status: 'pending' } : ad);
          return updated;
        });
      } else {
        setErrorMessage('Error restoring ad: ' + error.message);
      }
    } catch (err) {
      setErrorMessage('Exception: ' + err.message);
    }
    setActionLoading(null);
  };

  const handleVerify = async (id, currentStatus) => {
    setActionLoading(id + '-verify');
    try {
      const nextVerify = !currentStatus;
      const updates = {
        is_verified: nextVerify,
        created_at: new Date().toISOString()
      };
      const { error } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', id);
        
      if (!error) {
        setListings(prev => {
          const updated = prev.map(ad => ad.id === id ? { ...ad, is_verified: nextVerify, created_at: updates.created_at } : ad);
          return updated.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        });
      } else {
        setErrorMessage('Error verifying ad: ' + error.message);
      }
    } catch (err) {
      setErrorMessage('Exception: ' + err.message);
    }
    setActionLoading(null);
  };

  if (loading) return <div className="container" style={{padding: '5rem 0', textAlign: 'center'}}>Loading Admin Panel...</div>;
  if (!isAdmin) return null; // Prevent UI flash if not authorized

  const totalAds = listings.length;
  const pendingAds = listings.filter(ad => ad.status === 'pending').length;
  const activeAds = listings.filter(ad => ad.status === 'active').length;
  const rejectedAds = listings.filter(ad => ad.status === 'rejected').length;

  const displayedAds = adFilter === 'all' ? listings : listings.filter(ad => ad.status === adFilter);

  const isTabAllowed = (tab) => {
    if (!isModerator) return true;
    if (!moderatorInfo) return false;
    return moderatorInfo.allowed_sections?.includes(tab);
  };

  return (
    <div className={styles.adminWrapper}>
      <div className="container">
        
        {errorMessage && (
          <div style={{ background: '#fef2f2', color: '#991b1b', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} style={{ background: 'transparent', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>
        )}

        {confirmDialog && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '1rem'
          }}>
            <div style={{
              background: 'white', borderRadius: '16px', padding: '2rem',
              maxWidth: '360px', width: '100%', textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111' }}>
                {confirmDialog.title}
              </h3>
              <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                {confirmDialog.message}
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setConfirmDialog(null)}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '10px',
                    border: '1px solid #e5e7eb', background: 'white',
                    fontWeight: 600, cursor: 'pointer', fontSize: '0.95rem',
                    color: '#4b5563'
                  }}
                >
                  {lang === 'bn' ? 'না (No)' : 'No'}
                </button>
                <button
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  }}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '10px',
                    border: 'none', background: confirmDialog.isDestructive ? '#dc2626' : '#008b5e',
                    color: 'white', fontWeight: 700, cursor: 'pointer',
                    fontSize: '0.95rem', transition: 'background 0.2s'
                  }}
                >
                  {lang === 'bn' ? 'হ্যাঁ (Yes)' : 'Yes'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.header}>
          <h1 className={styles.title}>{lang === 'bn' ? 'অ্যাডমিন ড্যাশবোর্ড' : 'Admin Dashboard'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            
            <button 
              className={styles.logoutBtn}
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/');
              }}
            >
              <LogOut size={18} /> {lang === 'bn' ? 'লগআউট' : 'Logout'}
            </button>
          </div>
        </div>

        {/* Redesigned Premium Tab Navigation */}
        <div style={{
          display: 'flex', 
              gap: '0.65rem', 
              marginBottom: '2rem',
              background: 'rgba(243, 244, 246, 0.8)', 
              backdropFilter: 'blur(10px)',
              padding: '0.45rem', 
              borderRadius: '16px',
              width: 'fit-content',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)',
              border: '1px solid rgba(229, 231, 235, 0.5)',
              flexWrap: 'wrap'
            }}>
              {/* Ads Tab Button */}
              {isTabAllowed('ads') && (
                <button
                  onClick={() => handleTabChange('ads')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem', borderRadius: '12px', border: 'none',
                    background: activeTab === 'ads' ? 'white' : 'transparent',
                    color: activeTab === 'ads' ? '#008b5e' : '#64748b',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: activeTab === 'ads' ? '0 4px 12px rgba(0, 0, 0, 0.05)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: activeTab === 'ads' ? 'scale(1)' : 'scale(0.97)',
                  }}
                >
                  <LayoutDashboard size={15} color={activeTab === 'ads' ? '#008b5e' : '#64748b'} /> {lang === 'bn' ? 'অ্যাড মডারেশন' : 'Ads Moderation'}
                </button>
              )}

              {/* Featured Ads Tab Button */}
              {isTabAllowed('featured_ads') && (
                <button
                  onClick={() => handleTabChange('featured_ads')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem', borderRadius: '12px', border: 'none',
                    background: activeTab === 'featured_ads' ? 'white' : 'transparent',
                    color: activeTab === 'featured_ads' ? '#008b5e' : '#64748b',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: activeTab === 'featured_ads' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: activeTab === 'featured_ads' ? 'scale(1)' : 'scale(0.97)',
                  }}
                >
                  <Star size={15} color={activeTab === 'featured_ads' ? '#008b5e' : '#64748b'} /> {lang === 'bn' ? 'ফিচার্ড বিজ্ঞাপন' : 'Featured Ads'}
                </button>
              )}

              {/* Memberships Offers Tab Button */}
              {isTabAllowed('memberships') && (
                <button
                  onClick={() => handleTabChange('memberships')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem', borderRadius: '12px', border: 'none',
                    background: activeTab === 'memberships' ? 'white' : 'transparent',
                    color: activeTab === 'memberships' ? '#008b5e' : '#64748b',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: activeTab === 'memberships' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: activeTab === 'memberships' ? 'scale(1)' : 'scale(0.97)',
                  }}
                >
                  <Package size={15} color={activeTab === 'memberships' ? '#008b5e' : '#64748b'} /> {lang === 'bn' ? 'মেম্বারশিপ অফার' : 'Membership Offers'}
                </button>
              )}

              {/* Payment Gateways Tab Button */}
              {isTabAllowed('gateways') && (
                <button
                  onClick={() => handleTabChange('gateways')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem', borderRadius: '12px', border: 'none',
                    background: activeTab === 'gateways' ? 'white' : 'transparent',
                    color: activeTab === 'gateways' ? '#008b5e' : '#64748b',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: activeTab === 'gateways' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: activeTab === 'gateways' ? 'scale(1)' : 'scale(0.97)',
                  }}
                >
                  <Settings size={15} color={activeTab === 'gateways' ? '#008b5e' : '#64748b'} /> {lang === 'bn' ? 'পেমেন্ট গেটওয়ে' : 'Payment Gateways'}
                </button>
              )}

              {/* Payment Info Tab Button */}
              {isTabAllowed('payment_info') && (
                <button
                  onClick={() => handleTabChange('payment_info')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem', borderRadius: '12px', border: 'none',
                    background: activeTab === 'payment_info' ? 'white' : 'transparent',
                    color: activeTab === 'payment_info' ? '#008b5e' : '#64748b',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: activeTab === 'payment_info' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: activeTab === 'payment_info' ? 'scale(1)' : 'scale(0.97)',
                  }}
                >
                  {lang === 'bn' ? 'পেমেন্ট ইনফো' : 'Payment Info'}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Bell size={15} color={activeTab === 'payment_info' ? '#008b5e' : '#64748b'} />
                    {purchases.filter(p => p.status === 'pending').length > 0 && (
                      <span style={{
                        position: 'absolute', top: '-8px', right: '-10px',
                        background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 900,
                        width: '18px', height: '18px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1.5px solid white',
                      }}>
                        {purchases.filter(p => p.status === 'pending').length}
                      </span>
                    )}
                  </div>
                </button>
              )}

              {/* User Memberships Tab Button */}
              {isTabAllowed('users') && (
                <button
                  onClick={() => handleTabChange('users')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem', borderRadius: '12px', border: 'none',
                    background: activeTab === 'users' ? 'white' : 'transparent',
                    color: activeTab === 'users' ? '#008b5e' : '#64748b',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: activeTab === 'users' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: activeTab === 'users' ? 'scale(1)' : 'scale(0.97)',
                  }}
                >
                  <Users size={15} color={activeTab === 'users' ? '#008b5e' : '#64748b'} /> {lang === 'bn' ? 'ইউজার মেম্বারশিপ' : 'User Memberships'}
                </button>
              )}

              {/* Live Support Tab Button */}
              {isTabAllowed('support') && (
                <button
                  onClick={() => handleTabChange('support')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem', borderRadius: '12px', border: 'none',
                    background: activeTab === 'support' ? 'white' : 'transparent',
                    color: activeTab === 'support' ? '#008b5e' : '#64748b',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: activeTab === 'support' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: activeTab === 'support' ? 'scale(1)' : 'scale(0.97)',
                  }}
                >
                  <MessageSquare size={15} color={activeTab === 'support' ? '#008b5e' : '#64748b'} /> 
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {lang === 'bn' ? 'লাইভ সাপোর্ট' : 'Live Support'}
                    {totalUnreadSupport > 0 && (
                      <span style={{ background: '#ef4444', color: 'white', fontSize: '0.65rem', padding: '0.15rem 0.45rem', borderRadius: '10px', fontWeight: 'bold' }}>
                        {totalUnreadSupport}
                      </span>
                    )}
                  </span>
                </button>
              )}

              {/* Customer Support Customization Tab Button */}
              {isTabAllowed('support') && (
                <button
                  onClick={() => handleTabChange('support_settings')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem', borderRadius: '12px', border: 'none',
                    background: activeTab === 'support_settings' ? 'white' : 'transparent',
                    color: activeTab === 'support_settings' ? '#008b5e' : '#64748b',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: activeTab === 'support_settings' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: activeTab === 'support_settings' ? 'scale(1)' : 'scale(0.97)',
                  }}
                >
                  <Settings size={15} color={activeTab === 'support_settings' ? '#008b5e' : '#64748b'} /> {lang === 'bn' ? 'সাপোর্ট কাস্টমাইজেশন' : 'Support Customization'}
                </button>
              )}

              {/* Moderators Control Tab Button */}
              {!isModerator && (
                <button
                  onClick={() => handleTabChange('moderators')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.65rem 1.25rem', borderRadius: '12px', border: 'none',
                    background: activeTab === 'moderators' ? 'white' : 'transparent',
                    color: activeTab === 'moderators' ? '#008b5e' : '#64748b',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: activeTab === 'moderators' ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: activeTab === 'moderators' ? 'scale(1)' : 'scale(0.97)',
                  }}
                >
                  <Shield size={15} color={activeTab === 'moderators' ? '#008b5e' : '#64748b'} /> {lang === 'bn' ? 'মডারেটর কন্ট্রোল' : 'Moderator Control'}
                </button>
              )}
            </div>

        {/* Featured Ads Tab Content */}
        {activeTab === 'featured_ads' && (
          <div style={{
            background: 'white', borderRadius: '16px', padding: '1.75rem 2rem',
            boxShadow: '0 4px 25px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0',
            marginBottom: '2.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 850, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                  ★ {lang === 'bn' ? 'হোমপেজ ফিচার্ড বিজ্ঞাপন বোর্ড' : 'Homepage Featured Ads Board'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>
                  {lang === 'bn' ? 'এখানে আপনি ম্যানুয়ালি যেকোনো সক্রিয় বিজ্ঞাপনকে হোমপেজ স্লাইডারে যুক্ত করতে পারবেন, সক্রিয়/নিষ্ক্রিয় করতে পারবেন বা স্লাইডার থেকে সরিয়ে দিতে পারবেন।' : 'You can manually feature any active listing on the homepage slider, toggle its status, or remove it here.'}
                </p>
              </div>
              <button
                onClick={fetchFeaturedList}
                style={{
                  background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px',
                  padding: '0.65rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', color: '#475569',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.02)', outline: 'none', transition: 'all 0.2s',
                  height: '38px'
                }}
              >
                <RefreshCw size={14} className={featuredLoading ? styles.spin : ''} /> {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
              </button>
            </div>

            {/* Quick Add Section */}
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
              padding: '1.25rem', marginBottom: '2rem'
            }}>
              <h4 style={{ margin: '0 0 0.75rem 0', color: '#334155', fontSize: '0.85rem', fontWeight: 800 }}>
                {lang === 'bn' ? '➕ স্লাইডারে নতুন বিজ্ঞাপন যোগ করুন' : '➕ Feature a New Listing Manually'}
              </h4>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <select
                  id="manualFeaturedSelector"
                  style={{
                    flex: 1, minWidth: '280px', padding: '0.6rem 0.8rem', borderRadius: '8px',
                    border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 700,
                    background: 'white', outline: 'none'
                  }}
                >
                  <option value="">
                    {lang === 'bn' ? '-- একটি সক্রিয় বিজ্ঞাপন নির্বাচন করুন --' : '-- Select an Active Listing --'}
                  </option>
                  {listings.filter(lst => lst.status === 'active' && !featuredList.some(item => item.listing_id === lst.id)).map(lst => (
                    <option key={lst.id} value={lst.id}>
                      {lst.title} ({formatPrice(lst.price, lang)}) - {lst.location}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const selector = document.getElementById('manualFeaturedSelector');
                    if (selector && selector.value) {
                      handleAddManualFeatured(selector.value);
                      selector.value = '';
                    } else {
                      alert(lang === 'bn' ? 'অনুগ্রহ করে একটি বিজ্ঞাপন নির্বাচন করুন!' : 'Please select a listing first!');
                    }
                  }}
                  style={{
                    background: '#008b5e', color: 'white', border: 'none', borderRadius: '8px',
                    padding: '0.6rem 1.25rem', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer',
                    transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0, 139, 94, 0.2)'
                  }}
                >
                  {lang === 'bn' ? 'ফিচার করুন' : 'Feature Listing'}
                </button>
              </div>
            </div>

            {featuredLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontWeight: 600 }}>
                Loading featured ads list...
              </div>
            ) : featuredList.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '3rem', color: '#64748b', background: '#f8fafc',
                borderRadius: '12px', border: '1px dashed #cbd5e1'
              }}>
                {lang === 'bn' ? 'স্লাইডারে কোনো ফিচার্ড বিজ্ঞাপন নেই।' : 'No featured ads currently in the slider.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#475569' }}>{lang === 'bn' ? 'ছবি' : 'Image'}</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#475569' }}>{lang === 'bn' ? 'বিজ্ঞাপনের নাম' : 'Listing Title'}</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#475569' }}>{lang === 'bn' ? 'মূল্য ও অবস্থান' : 'Price & Location'}</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#475569' }}>{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#475569', textAlign: 'right' }}>{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {featuredList.map(item => {
                      const lst = item.listing;
                      if (!lst) return null;
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s' }}>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <img
                              src={lst.images?.[0] || 'https://via.placeholder.com/60x40?text=No+Image'}
                              alt={lst.title}
                              style={{ width: '55px', height: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                            />
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0f172a' }}>
                            <Link href={`/ad/${lst.id}`} target="_blank" style={{ color: '#0f172a', textDecoration: 'none' }}>
                              {lst.title}
                            </Link>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: 600 }}>
                            <div>{formatPrice(lst.price, lang)}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.1rem' }}>📍 {lst.location}</div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              background: item.is_active ? '#dcfce7' : '#fee2e2',
                              color: item.is_active ? '#15803d' : '#b91c1c',
                              fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '6px', textTransform: 'uppercase'
                            }}>
                              {item.is_active ? (lang === 'bn' ? 'সক্রিয়' : 'Active') : (lang === 'bn' ? 'নিষ্ক্রিয়' : 'Inactive')}
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleToggleFeaturedActive(item.id, item.is_active)}
                                style={{
                                  background: item.is_active ? '#cbd5e1' : '#008b5e',
                                  color: item.is_active ? '#1e293b' : 'white',
                                  border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem',
                                  fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                              >
                                {item.is_active ? (lang === 'bn' ? 'ডিঅ্যাক্টিভেট' : 'Deactivate') : (lang === 'bn' ? 'অ্যাক্টিভেট' : 'Activate')}
                              </button>
                              <button
                                onClick={() => confirmAction(
                                  'ফিচার স্লাইডার থেকে সরাবেন?', 'Remove from Featured?',
                                  'এই বিজ্ঞাপনটি হোমপেজ স্লাইডার থেকে সরানো হবে। এটি সাইট থেকে ডিলিট হবে না।', 'This will remove the listing from the featured slider. It will NOT delete the ad itself.',
                                  () => handleDeleteFeatured(item.id),
                                  true
                                )}
                                style={{
                                  background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5',
                                  borderRadius: '6px', padding: '0.35rem 0.65rem',
                                  fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.2s',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Gateways Tab Content */}
        {activeTab === 'gateways' && (
          <div style={{
            background: 'white', borderRadius: '16px', padding: '1.25rem 1.5rem',
            boxShadow: '0 4px 25px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>
                  ⚙️ {lang === 'bn' ? 'পেমেন্ট গেটওয়ে সেটিংস' : 'Payment Gateways Setup'}
                </h3>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0 0 1.25rem 0', fontWeight: 500 }}>
              {lang === 'bn' ? 'এখানে আপনার বিকাশ ও নগদ গেটওয়ে নাম্বার এবং তার টাইপ (Personal / Agent / Merchant) সেট করুন।' : 'Set your bKash and Nagad gateway numbers and types (Personal / Agent / Merchant) here.'}
            </p>
              </div>
              <button
                onClick={fetchSettings}
                style={{
                  background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px',
                  padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#475569',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.02)', outline: 'none', transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                <RefreshCw size={14} className={settingsLoading ? styles.spin : ''} /> {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              
              {/* bKash Configuration */}
              <div style={{ border: '1px solid #fecaca', background: '#fff5f5', borderRadius: '12px', padding: '1rem' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#be123c', fontWeight: 800, fontSize: '0.8rem', margin: '0 0 0.75rem 0' }}>
                  {lang === 'bn' ? 'বিকাশ' : 'bKash Gateway'}
                </h4>
                
                <div style={{ marginBottom: '0.6rem' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>{lang === 'bn' ? 'গেটওয়ে নাম্বার' : 'Gateway Number'}</label>
                  <input
                    type="text"
                    value={bkashNum}
                    onChange={e => setBkashNum(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 700 }}
                    placeholder="e.g. 017xxxxxxxx"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>{lang === 'bn' ? 'গেটওয়ে টাইপ' : 'Gateway Type'}</label>
                  <select
                    value={bkashType}
                    onChange={e => setBkashType(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 700, background: 'white' }}
                  >
                    <option value="Personal">Personal (পার্সোনাল)</option>
                    <option value="Agent">Agent (এজেন্ট)</option>
                    <option value="Merchant">Merchant (মার্চেন্ট)</option>
                  </select>
                </div>
              </div>

              {/* Nagad Configuration */}
              <div style={{ border: '1px solid #fed7aa', background: '#fffbeb', borderRadius: '12px', padding: '1rem' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#c2410c', fontWeight: 800, fontSize: '0.8rem', margin: '0 0 0.75rem 0' }}>
                  {lang === 'bn' ? 'নগদ' : 'Nagad Gateway'}
                </h4>
                
                <div style={{ marginBottom: '0.6rem' }}>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>{lang === 'bn' ? 'গেটওয়ে নাম্বার' : 'Gateway Number'}</label>
                  <input
                    type="text"
                    value={nagadNum}
                    onChange={e => setNagadNum(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 700 }}
                    placeholder="e.g. 018xxxxxxxx"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>{lang === 'bn' ? 'গেটওয়ে টাইপ' : 'Gateway Type'}</label>
                  <select
                    value={nagadType}
                    onChange={e => setNagadType(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', fontWeight: 700, background: 'white' }}
                  >
                    <option value="Personal">Personal (পার্সোনাল)</option>
                    <option value="Agent">Agent (এজেন্ট)</option>
                    <option value="Merchant">Merchant (মার্চেন্ট)</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={saveSettings}
                disabled={savingSettings}
                style={{
                  padding: '0.55rem 1.25rem', borderRadius: '8px', border: 'none',
                  background: 'linear-gradient(135deg, #008b5e, #05b078)', color: 'white',
                  fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 10px rgba(0, 139, 94, 0.2)'
                }}
              >
                {savingSettings ? (lang === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...') : (lang === 'bn' ? 'সেটিংস সেভ করুন' : 'Save Settings')}
              </button>
            </div>
          </div>
        )}

        {/* Users Tab Content (Manual membership control) */}
        {activeTab === 'users' && (
          <div style={{
            background: 'white', borderRadius: '16px', padding: '1.75rem 2rem',
            boxShadow: '0 4px 25px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0',
            marginBottom: '2.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 850, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                  👤 {lang === 'bn' ? 'ইউজার মেম্বারশিপ কন্ট্রোল' : 'User Memberships & Control Panel'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>
                  {lang === 'bn' ? 'এখানে সমস্ত রেজিস্টার্ড ইউজারদের মেম্বারশিপ ট্যাগ এবং তাদের এক্সপায়ারি ডেট ম্যানুয়ালি এডিট করা যাবে।' : 'You can manually edit the membership tags and expiry dates for all registered users here.'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', minWidth: '280px' }}>
                  <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder={lang === 'bn' ? "ইমেইল দিয়ে সার্চ করুন..." : "Search users by email..."}
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem 0.65rem 2.5rem',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      outline: 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                    }}
                  />
                </div>
                <button
                  onClick={fetchProfiles}
                  style={{
                    background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px',
                    padding: '0.65rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', color: '#475569',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.02)', outline: 'none', transition: 'all 0.2s',
                    height: '38px'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#94a3b8';
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.color = '#0f172a';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.color = '#475569';
                  }}
                >
                  <RefreshCw size={14} className={profilesLoading ? styles.spin : ''} /> {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
                </button>
              </div>
            </div>

            {profilesLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontWeight: 600 }}>
                Loading profiles list...
              </div>
            ) : profiles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                No users found.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#475569' }}>{lang === 'bn' ? 'ইমেইল' : 'User Email'}</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#475569' }}>{lang === 'bn' ? 'নাম' : 'Full Name'}</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#475569' }}>{lang === 'bn' ? 'মেম্বারশিপ ট্যাগ' : 'Membership Tag'}</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#475569' }}>{lang === 'bn' ? 'মেয়াদ' : 'Expiry Date'}</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 800, color: '#475569', textAlign: 'right' }}>{lang === 'bn' ? 'অ্যাকশন' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.filter(user => user.email.toLowerCase().includes(userSearchQuery.toLowerCase())).map(user => {
                      const isEditing = editingProfile?.id === user.id;
                      const formattedExpiry = user.membership_expires_at 
                        ? (lang === 'bn' ? toBengaliNumber(new Date(user.membership_expires_at).toLocaleDateString(), 'bn') : new Date(user.membership_expires_at).toLocaleDateString())
                        : (lang === 'bn' ? 'প্রযোজ্য নয়' : 'N/A');
                      
                      return (
                        <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'all 0.2s' }}>
                          <td style={{ padding: '1rem', fontWeight: 700, color: '#0f172a' }}>{user.email}</td>
                          <td style={{ padding: '1rem', color: '#475569', fontWeight: 500 }}>{user.full_name || (lang === 'bn' ? 'প্রযোজ্য নয়' : 'N/A')}</td>
                          
                          {/* Membership Display or Edit */}
                          <td style={{ padding: '1rem' }}>
                            {isEditing ? (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <select
                                   value={
                                     ['free', 'Silver Member', 'Gold Member', 'Business Member', '3-Day Express Boost', '7-Day Premium Boost', '15-Day Mega Boost'].includes(editingProfile.membership_type)
                                       ? editingProfile.membership_type 
                                       : 'custom'
                                   }
                                   onChange={e => {
                                     const val = e.target.value;
                                     if (val === 'custom') {
                                       setEditingProfile({ ...editingProfile, membership_type: '2-Day Premium Boost', isCustom: true });
                                     } else {
                                       setEditingProfile({ ...editingProfile, membership_type: val, isCustom: false });
                                     }
                                   }}
                                   style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 700, background: 'white' }}
                                 >
                                <option value="free">{lang === 'bn' ? 'ফ্রি (Free)' : 'Free'}</option>
                                <option value="Silver Member">{lang === 'bn' ? 'সিলভার মেম্বার (Silver)' : 'Silver Member'}</option>
                                <option value="Gold Member">{lang === 'bn' ? 'গোল্ড মেম্বার (Gold)' : 'Gold Member'}</option>
                                <option value="Business Member">{lang === 'bn' ? 'বিজনেস মেম্বার (Business)' : 'Business Member'}</option>
                                <option value="3-Day Express Boost">{lang === 'bn' ? '৩ দিনের এক্সপ্রেস বুস্ট' : '3-Day Express Boost'}</option>
                                <option value="7-Day Premium Boost">{lang === 'bn' ? '৭ দিনের প্রিমিয়াম বুস্ট' : '7-Day Premium Boost'}</option>
                                <option value="15-Day Mega Boost">{lang === 'bn' ? '১৫ দিনের মেগা বুস্ট' : '15-Day Mega Boost'}</option>
                                <option value="custom">{lang === 'bn' ? '✍️ কাস্টম ট্যাগ (Custom)' : '✍️ Custom Tag'}</option>
                                {!['free', 'Silver Member', 'Gold Member', 'Business Member', '3-Day Express Boost', '7-Day Premium Boost', '15-Day Mega Boost'].includes(editingProfile.membership_type) && (
                                  <option value={editingProfile.membership_type}>{getTranslatedPackageName(editingProfile.membership_type, lang)}</option>
                                )}
                              </select>

                              {(!['free', 'Silver Member', 'Gold Member', 'Business Member', '3-Day Express Boost', '7-Day Premium Boost', '15-Day Mega Boost'].includes(editingProfile.membership_type) || editingProfile.isCustom) && (
                                <input
                                  type="text"
                                  value={editingProfile.membership_type}
                                  onChange={e => setEditingProfile({ ...editingProfile, membership_type: e.target.value, isCustom: true })}
                                  placeholder={lang === 'bn' ? 'যেমন: 2-Day Premium Boost' : 'e.g. 2-Day Premium Boost'}
                                  style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '2px dashed #008b5e', fontSize: '0.8rem', fontWeight: 700, width: '180px', marginTop: '0.25rem' }}
                                />
                              )}
                            </div>
                            ) : (
                              <span style={{
                                background: (!user.membership_type || user.membership_type.toLowerCase() === 'free') ? '#f1f5f9' : 
                                            user.membership_type.toLowerCase().includes('silver') ? '#e0f2fe' : 
                                            user.membership_type.toLowerCase().includes('gold') ? '#fef3c7' : '#dcfce7',
                                color: (!user.membership_type || user.membership_type.toLowerCase() === 'free') ? '#64748b' : 
                                       user.membership_type.toLowerCase().includes('silver') ? '#0369a1' : 
                                       user.membership_type.toLowerCase().includes('gold') ? '#b45309' : '#15803d',
                                fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '6px', textTransform: 'uppercase'
                              }}>
                                {(!user.membership_type || user.membership_type.toLowerCase() === 'free') 
                                  ? (lang === 'bn' ? 'ফ্রি' : 'Free') 
                                  : getTranslatedPackageName(user.membership_type, lang)}
                              </span>
                            )}
                          </td>

                          {/* Expiry Display or Edit */}
                          <td style={{ padding: '1rem', color: '#475569' }}>
                            {isEditing ? (
                              <input
                                type="date"
                                value={editingProfile.membership_expires_at ? editingProfile.membership_expires_at.split('T')[0] : ''}
                                onChange={e => setEditingProfile({ ...editingProfile, membership_expires_at: e.target.value })}
                                style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontWeight: 700 }}
                              />
                            ) : (
                              <span style={{ fontWeight: 600 }}>{formattedExpiry}</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '1rem', textAlign: 'right' }}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => confirmAction(
                                    'মেম্বারশিপ আপডেট করবেন?', 'Update Membership?',
                                    'আপনি কি নিশ্চিত যে আপনি এই ইউজারের মেম্বারশিপ আপডেট করতে চান?', 'Are you sure you want to update this user\'s membership?',
                                    () => handleUpdateManualMembership(user.id, editingProfile.membership_type, editingProfile.membership_expires_at)
                                  )}
                                  style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer' }}
                                >
                                  {lang === 'bn' ? 'সংরক্ষণ' : 'Save'}
                                </button>
                                <button
                                  onClick={() => setEditingProfile(null)}
                                  style={{ background: '#cbd5e1', color: '#334155', border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer' }}
                                >
                                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setEditingProfile({ id: user.id, email: user.email, membership_type: user.membership_type || 'free', membership_expires_at: user.membership_expires_at || '' })}
                                style={{ background: 'white', border: '1px solid #cbd5e1', color: '#008b5e', borderRadius: '6px', padding: '0.35rem 0.75rem', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.2s' }}
                              >
                                {lang === 'bn' ? 'ট্যাগ এডিট' : 'Edit Tag'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Memberships Tab */}
        {activeTab === 'memberships' && <MembershipManager />}

        {/* Ads Tab */}
        {activeTab === 'ads' && (
          <>
            <div style={{
              background: 'white', borderRadius: '16px', padding: '1.25rem 1.5rem',
              boxShadow: '0 4px 25px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0',
              marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
            }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>
                  📢 {lang === 'bn' ? 'বিজ্ঞাপন মডারেশন কন্ট্রোল' : 'Ads Moderation Control'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0, fontWeight: 500 }}>
                  {lang === 'bn' ? 'নতুন পোস্ট করা বিজ্ঞাপনগুলো অনুমোদন বা বাতিল করুন।' : 'Approve or reject newly posted classified listings here.'}
                </p>
              </div>
              <button
                onClick={fetchListings}
                style={{
                  background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px',
                  padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#475569',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.02)', outline: 'none', transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#94a3b8';
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                <RefreshCw size={14} className={adsLoading ? styles.spin : ''} /> {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => setAdFilter('all')}
                style={{
                  background: adFilter === 'all' ? '#008b5e' : 'white',
                  color: adFilter === 'all' ? 'white' : '#475569',
                  border: `1px solid ${adFilter === 'all' ? '#008b5e' : '#cbd5e1'}`,
                  borderRadius: '10px', padding: '0.6rem 0.8rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{lang === 'bn' ? 'মোট বিজ্ঞাপন' : 'Total Ads'}</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900 }}>{toBengaliNumber(totalAds, lang)}</span>
              </button>

              <button 
                onClick={() => setAdFilter('pending')}
                style={{
                  background: adFilter === 'pending' ? '#d97706' : 'white',
                  color: adFilter === 'pending' ? 'white' : '#475569',
                  border: `1px solid ${adFilter === 'pending' ? '#d97706' : '#cbd5e1'}`,
                  borderRadius: '10px', padding: '0.6rem 0.8rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{lang === 'bn' ? 'অনুমোদন পেন্ডিং' : 'Pending'}</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900 }}>{toBengaliNumber(pendingAds, lang)}</span>
              </button>

              <button 
                onClick={() => setAdFilter('active')}
                style={{
                  background: adFilter === 'active' ? '#0284c7' : 'white',
                  color: adFilter === 'active' ? 'white' : '#475569',
                  border: `1px solid ${adFilter === 'active' ? '#0284c7' : '#cbd5e1'}`,
                  borderRadius: '10px', padding: '0.6rem 0.8rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{lang === 'bn' ? 'সক্রিয় বিজ্ঞাপন' : 'Active Ads'}</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900 }}>{toBengaliNumber(activeAds, lang)}</span>
              </button>

              <button 
                onClick={() => setAdFilter('rejected')}
                style={{
                  background: adFilter === 'rejected' ? '#dc2626' : 'white',
                  color: adFilter === 'rejected' ? 'white' : '#475569',
                  border: `1px solid ${adFilter === 'rejected' ? '#dc2626' : '#cbd5e1'}`,
                  borderRadius: '10px', padding: '0.6rem 0.8rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', transition: 'all 0.2s',
                  outline: 'none'
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.2rem' }}>{lang === 'bn' ? 'বাতিল অ্যাড' : 'Rejected'}</span>
                <span style={{ fontSize: '1.35rem', fontWeight: 900 }}>{toBengaliNumber(rejectedAds, lang)}</span>
              </button>
            </div>

            <div className={styles.adGrid}>
              {displayedAds.map(ad => (
                <div key={ad.id} className={styles.adCard}>
                  <Link href={`/ad/${ad.id}`} className={styles.cardLink}>
                    <div className={styles.cardHeader}>
                      <img 
                        src={ad.images?.[0] || 'https://via.placeholder.com/300x200?text=No+Image'} 
                        alt={ad.title} 
                        className={styles.cardImage} 
                      />
                      <div className={styles.statusBadges}>
                        <span className={`${styles.badge} ${ad.status === 'pending' ? styles.badgePending : ad.status === 'active' ? styles.badgeActive : ''}`} style={ad.status === 'rejected' ? {background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca'} : {}}>
                          {ad.status === 'pending' ? (lang === 'bn' ? 'পেন্ডিং' : 'Pending') : ad.status === 'active' ? (lang === 'bn' ? 'সক্রিয়' : 'Active') : (lang === 'bn' ? 'বাতিল' : 'Rejected')}
                        </span>
                        {ad.is_verified && (
                          <span style={{ background: '#fef08a', color: '#854d0e', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                            ★ {lang === 'bn' ? 'ভেরিফাইড' : 'Verified'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <h3 className={styles.cardTitle}>{ad.title}</h3>
                      <div className={styles.cardPrice}>{formatPrice(ad.price, lang)}</div>
                      <div className={styles.cardMeta}>
                        <span>{lang === 'bn' ? `ক্যাটাগরি: ${t(ad.category_id)}` : `Category: ${ad.category_id}`}</span>
                        <span>{lang === 'bn' ? `পোস্ট করা হয়েছে: ${formatFullDate(ad.created_at, lang)}` : `Posted: ${formatFullDate(ad.created_at, lang)}`}</span>
                      </div>
                    </div>
                  </Link>
                  
                  <div className={styles.cardFooter} style={{ flexDirection: 'column', gap: '0.5rem' }}>
                    <div className={styles.actionBtns} style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                      {ad.status === 'pending' && (
                        <button 
                          className={`${styles.btn} ${styles.btnApprove}`}
                          onClick={(e) => { 
                            e.preventDefault(); e.stopPropagation(); 
                            confirmAction(
                              'বিজ্ঞাপনটি অনুমোদন করবেন?', 'Approve Ad?',
                              'এই বিজ্ঞাপনটি লাইভ করা হবে।', 'This ad will be visible to the public.',
                              () => handleApprove(ad.id)
                            );
                          }}
                          disabled={actionLoading === ad.id}
                          style={{ flex: 1, marginRight: '0.5rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                        >
                          <Check size={14} /> {lang === 'bn' ? 'অনুমোদন দিন' : 'Approve'}
                        </button>
                      )}
                      {ad.status === 'active' && (
                        <button 
                          className={`${styles.btn}`}
                          style={{ 
                            flex: 1, 
                            marginRight: '0.5rem', 
                            background: ad.is_verified ? '#eab308' : '#fef08a', 
                            color: ad.is_verified ? 'white' : '#854d0e', 
                            border: '1px solid #fde047',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem',
                            cursor: 'pointer'
                          }}
                          onClick={(e) => { 
                            e.preventDefault(); e.stopPropagation(); 
                            confirmAction(
                              ad.is_verified ? 'আনভেরিফাই করবেন?' : 'প্রিমিয়াম করবেন?',
                              ad.is_verified ? 'Unverify Ad?' : 'Make Premium?',
                              ad.is_verified ? 'এই বিজ্ঞাপনটি থেকে প্রিমিয়াম ট্যাগ সরানো হবে।' : 'এই বিজ্ঞাপনটিতে প্রিমিয়াম ট্যাগ যুক্ত করা হবে।',
                              ad.is_verified ? 'This ad will lose its premium tag.' : 'This ad will gain a premium tag.',
                              () => handleVerify(ad.id, ad.is_verified)
                            );
                          }}
                          disabled={actionLoading === ad.id + '-verify'}
                        >
                          <Star size={14} fill={ad.is_verified ? "currentColor" : "none"} /> 
                          {ad.is_verified ? (lang === 'bn' ? 'আনভেরিফাই' : 'Unverify') : (lang === 'bn' ? 'প্রিমিয়াম করুন' : 'Make Premium')}
                        </button>
                      )}
                      {ad.status === 'rejected' && (
                        <button 
                          className={`${styles.btn}`}
                          style={{ 
                            flex: 1, 
                            marginRight: '0.5rem', 
                            background: '#3b82f6', 
                            color: 'white', 
                            border: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem',
                            cursor: 'pointer'
                          }}
                          onClick={(e) => { 
                            e.preventDefault(); e.stopPropagation(); 
                            confirmAction(
                              'বিজ্ঞাপনটি পুনরুদ্ধার করবেন?', 'Restore Ad?',
                              'এই বিজ্ঞাপনটি আবার পেন্ডিং তালিকায় ফিরিয়ে আনা হবে।', 'This ad will be restored back to the pending queue.',
                              () => handleRestore(ad.id)
                            );
                          }}
                          disabled={actionLoading === ad.id}
                        >
                          <RefreshCw size={14} /> 
                          {lang === 'bn' ? 'পুনরুদ্ধার করুন' : 'Restore'}
                        </button>
                      )}
                      <button 
                        className={`${styles.btn} ${styles.btnReject}`}
                        onClick={(e) => { 
                          e.preventDefault(); e.stopPropagation(); 
                          if (ad.status === 'rejected') {
                            confirmDelete(ad.id);
                          } else {
                            confirmReject(ad.id);
                          }
                        }}
                        disabled={actionLoading === ad.id}
                        style={{ padding: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        title={lang === 'bn' ? (ad.status === 'rejected' ? 'স্থায়ীভাবে মুছুন' : 'বাতিল করুন') : (ad.status === 'rejected' ? 'Delete Permanently' : 'Reject')}
                      >
                        <Trash2 size={14} />
                      </button>
                      <Link 
                        href={`/ad/${ad.id}`} 
                        className={`${styles.btn} ${styles.btnView}`}
                        style={{ padding: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: '0.3rem', textDecoration: 'none' }}
                        title={lang === 'bn' ? 'সরাসরি দেখুন' : 'View Live'}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                    {ad.is_verified && (
                      <div style={{ width: '100%', textAlign: 'center', paddingTop: '0.3rem', borderTop: '1px dashed #fde047' }}>
                        <span style={{ color: '#d97706', fontWeight: 900, fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                          <Star size={12} fill="#d97706" /> {lang === 'bn' ? '★ প্রিমিয়াম লিস্টিং' : '★ Premium Listing'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {listings.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '5rem 0', color: '#718096', fontWeight: 600 }}>
                  {lang === 'bn' ? 'কোনো বিজ্ঞাপন পাওয়া যায়নি।' : 'No ads found in the database.'}
                </div>
              )}
            </div>
          </>
        )}

        {/* Payment Info Tab Content */}
        {activeTab === 'payment_info' && (
          <div style={{
            background: 'white', borderRadius: '16px', padding: '1.25rem 1.5rem',
            boxShadow: '0 4px 25px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    🔔 {lang === 'bn' ? 'পেমেন্ট রিকোয়েস্ট' : 'Payment Requests'} ({purchaseFilter === 'all' ? purchases.length : purchases.filter(p => p.status === purchaseFilter).length})
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      onClick={() => setPurchaseFilter('all')}
                      style={getPurchaseFilterBtnStyle(purchaseFilter === 'all', '#64748b')}
                    >
                      {lang === 'bn' ? 'সবগুলো' : 'All'}
                    </button>
                    <button 
                      onClick={() => setPurchaseFilter('pending')}
                      style={getPurchaseFilterBtnStyle(purchaseFilter === 'pending', '#d97706')}
                    >
                      {lang === 'bn' ? 'পেন্ডিং' : 'Pending'}
                    </button>
                    <button 
                      onClick={() => setPurchaseFilter('approved')}
                      style={getPurchaseFilterBtnStyle(purchaseFilter === 'approved', '#10b981')}
                    >
                      {lang === 'bn' ? 'অনুমোদিত' : 'Approved'}
                    </button>
                    <button 
                      onClick={() => setPurchaseFilter('rejected')}
                      style={getPurchaseFilterBtnStyle(purchaseFilter === 'rejected', '#ef4444')}
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Rejected'}
                    </button>
                  </div>
                </div>
                <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0, fontWeight: 500 }}>
                  {purchaseFilter === 'pending' 
                    ? (lang === 'bn' ? 'আগে আসা রিকোয়েস্টগুলো আগে দেখানো হচ্ছে (FIFO Order)' : 'Ascending FIFO order (oldest first)')
                    : (lang === 'bn' ? 'নতুন রিকোয়েস্টগুলো আগে দেখানো হচ্ছে' : 'Descending order (newest first)')}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', minWidth: '250px' }}>
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder={lang === 'bn' ? "ইমেইল দিয়ে সার্চ করুন..." : "Search by email..."}
                    value={paymentSearchQuery}
                    onChange={(e) => setPaymentSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 1rem 0.5rem 2.2rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      outline: 'none',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                    }}
                  />
                </div>
                <button
                  onClick={fetchPurchases}
                  style={{
                    background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px',
                    padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#475569',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                  }}
                >
                  <RefreshCw size={14} className={purchasesLoading ? styles.spin : ''} /> {lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {purchasesLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontWeight: 600 }}>
                  {lang === 'bn' ? 'পেমেন্ট নোটিফিকেশন লোড হচ্ছে...' : 'Loading payment notifications...'}
                </div>
              ) : purchases.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b', background: '#f8fafc', borderRadius: '16px', border: '1.5px dashed #cbd5e1' }}>
                  🎉 {lang === 'bn' ? 'কোনো পেমেন্ট রিকোয়েস্ট নেই!' : 'No payment requests found!'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                  {purchases
                    .filter(req => purchaseFilter === 'all' || req.status === purchaseFilter)
                    .filter(req => req.user_email?.toLowerCase().includes(paymentSearchQuery.toLowerCase()))
                    .sort((a, b) => {
                      if (purchaseFilter === 'pending') {
                        return new Date(a.created_at) - new Date(b.created_at);
                      } else {
                        return new Date(b.created_at) - new Date(a.created_at);
                      }
                    })
                    .map(req => {
                      const isPending = req.status === 'pending';
                    const dateStr = new Date(req.created_at).toLocaleString();
                    
                    return (
                      <div key={req.id} style={{
                        border: isPending ? '2px solid #fbbf24' : '1px solid #e2e8f0',
                        background: isPending ? '#fffdf5' : 'white',
                        borderRadius: '16px', padding: '1.15rem',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.015)',
                        transition: 'all 0.2s',
                        display: 'flex', flexDirection: 'column'
                      }}>
                        {/* Title and Method Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                          <div>
                            <span style={{ fontWeight: 850, color: '#0f172a', fontSize: '0.9rem' }}>{getTranslatedPackageName(req.package_name, lang)}</span>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>📅 {dateStr}</div>
                          </div>
                          <span style={{
                            background: req.payment_method === 'bkash' ? '#ffe1e6' : '#ffedd5',
                            color: req.payment_method === 'bkash' ? '#be123c' : '#c2410c',
                            fontSize: '0.68rem', fontWeight: 900, padding: '0.2rem 0.5rem', borderRadius: '6px', textTransform: 'uppercase'
                          }}>
                            {req.payment_method}
                          </span>
                        </div>

                        {/* Details Grid */}
                        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem 0.85rem', marginBottom: '0.85rem', fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span>👤 {lang === 'bn' ? 'ইমেইল:' : 'Email:'} <strong style={{ color: '#0f172a' }}>{req.user_email}</strong></span>
                          <span>💰 {lang === 'bn' ? 'দাম/প্রাইস:' : 'Price:'} <strong style={{ color: '#0f172a' }}>{lang === 'bn' ? `টাকা ${toBengaliNumber(req.price, lang)}` : `Tk ${req.price.toLocaleString()}`}</strong></span>
                          <span>📞 {lang === 'bn' ? 'প্রেরক নম্বর:' : 'Sender:'} <strong style={{ color: '#0f172a' }}>{toBengaliNumber(req.sender_number, lang)}</strong></span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🔑 {lang === 'bn' ? 'লেনদেন আইডি:' : 'TxnID:'} 
                            <strong style={{ fontFamily: 'monospace', color: '#008b5e', background: '#dcfce7', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.82rem' }}>
                              {req.transaction_id}
                            </strong>
                          </span>
                          {req.listing_id && (
                            <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>
                              📌 {lang === 'bn' ? `বুস্ট লিস্টিং আইডি: ${req.listing_id}` : `Boost Listing ID: ${req.listing_id}`}
                            </span>
                          )}
                        </div>

                        {/* Screenshot Proof */}
                        {req.screenshot_url && (
                          <div style={{ marginBottom: 'auto' }}>
                            <a href={req.screenshot_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.72rem', color: '#475569', fontWeight: 700, marginBottom: '0.85rem' }}>
                              <Eye size={12} /> {lang === 'bn' ? 'পেমেন্টের রসিদ দেখুন' : 'View Receipt Proof'}
                            </a>
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: req.screenshot_url ? '0' : 'auto' }}>
                          {isPending ? (
                            <>
                              <button
                                onClick={() => confirmAction(
                                  'পেমেন্ট অনুমোদন করবেন?', 'Approve Payment?',
                                  'এই ইউজারের মেম্বারশিপ বা বুস্ট সক্রিয় করা হবে।', 'This user\'s membership or boost will be activated.',
                                  () => handlePurchaseStatus(req.id, 'approved')
                                )}
                                style={{
                                  padding: '0.45rem 1rem', borderRadius: '8px', border: 'none',
                                  background: '#10b981', color: 'white', fontWeight: 800, fontSize: '0.75rem',
                                  cursor: 'pointer', boxShadow: '0 2px 6px rgba(16,185,129,0.2)', flex: 1
                                }}
                              >
                                {lang === 'bn' ? 'অনুমোদন করুন' : 'Approve'}
                              </button>
                              <button
                                onClick={() => confirmAction(
                                  'পেমেন্ট প্রত্যাখ্যান করবেন?', 'Reject Payment?',
                                  'এই রিকোয়েস্টটি বাতিল করা হবে।', 'This request will be rejected.',
                                  () => handlePurchaseStatus(req.id, 'rejected'),
                                  true
                                )}
                                style={{
                                  padding: '0.45rem 1rem', borderRadius: '8px', border: 'none',
                                  background: '#ef4444', color: 'white', fontWeight: 800, fontSize: '0.75rem',
                                  cursor: 'pointer', boxShadow: '0 2px 6px rgba(239,68,68,0.2)', flex: 1
                                }}
                              >
                                {lang === 'bn' ? 'প্রত্যাখ্যান করুন' : 'Reject'}
                              </button>
                            </>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <span style={{
                                background: req.status === 'approved' ? '#dcfce7' : '#fee2e2',
                                color: req.status === 'approved' ? '#15803d' : '#b91c1c',
                                fontSize: '0.72rem', fontWeight: 800, padding: '0.25rem 0.6rem', borderRadius: '6px'
                              }}>
                                {req.status === 'approved' ? (lang === 'bn' ? '✓ অনুমোদিত' : '✓ APPROVED') : (lang === 'bn' ? '✗ প্রত্যাখ্যাত' : '✗ REJECTED')}
                              </span>
                              <button
                                onClick={() => confirmAction(
                                  'পেন্ডিং এ রিসেট করবেন?', 'Reset to Pending?',
                                  'স্ট্যাটাস আবার পেন্ডিং করা হবে।', 'The status will be reset to pending.',
                                  () => handlePurchaseStatus(req.id, 'pending')
                                )}
                                style={{
                                  background: 'transparent', border: 'none', color: '#64748b',
                                  fontSize: '0.7rem', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600
                                }}
                              >
                                {lang === 'bn' ? 'পেন্ডিং এ রিসেট করুন' : 'Reset to Pending'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'moderators' && !isModerator && (
          <div style={{
            background: 'white', borderRadius: '16px', padding: '1.5rem',
            boxShadow: '0 4px 25px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0',
            marginBottom: '2rem'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
              🛡️ {lang === 'bn' ? 'মডারেটর কন্ট্রোল ও অ্যাক্সেস পারমিশন' : 'Moderator Control & Access Permissions'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.78rem', margin: '0 0 1.5rem 0', fontWeight: 500 }}>
              {lang === 'bn' ? 'এখানে আপনি ইমেইল দিয়ে নতুন মডারেটর যুক্ত করতে পারবেন এবং নির্দিষ্ট সেকশনে তাদের কাজের অনুমতি নিয়ন্ত্রণ করতে পারবেন।' : 'Add moderators using their email and precisely customize which panels they are allowed to access.'}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              
              {/* Form to Add / Edit */}
              <div style={{
                background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '14px',
                padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem'
              }}>
                <h4 style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b', margin: '0 0 0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {modEditingEmail ? (lang === 'bn' ? 'মডারেটর তথ্য এডিট' : 'Edit Moderator Info') : (lang === 'bn' ? 'নতুন মডারেটর যুক্ত করুন' : 'Add New Moderator')}
                </h4>
                
                <form onSubmit={handleAddModerator} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                      {lang === 'bn' ? 'নাম' : 'Name'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === 'bn' ? "যেমন: সাবিহ আহমেদ" : "e.g. Sabih Ahmed"}
                      value={modName}
                      onChange={e => setModName(e.target.value)}
                      style={{
                        padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                        fontSize: '0.8rem', fontWeight: 500, outline: 'none', background: 'white'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                      {lang === 'bn' ? 'ইমেইল অ্যাড্রেস' : 'Email Address'}
                    </label>
                    <input
                      type="email"
                      required
                      placeholder={lang === 'bn' ? "যেমন: sabih@example.com" : "e.g. sabih@example.com"}
                      value={modEmail}
                      onChange={e => setModEmail(e.target.value)}
                      style={{
                        padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                        fontSize: '0.8rem', fontWeight: 500, outline: 'none', background: 'white'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.25rem 0' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>
                      {lang === 'bn' ? 'অ্যাক্সেস পারমিশনসমূহ' : 'Panel Access Settings'}
                    </span>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingLeft: '0.2rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={modSections.ads}
                          onChange={e => setModSections({ ...modSections, ads: e.target.checked })}
                          style={{ accentColor: '#008b5e', cursor: 'pointer' }}
                        />
                        📢 {lang === 'bn' ? 'অ্যাড মডারেশন' : 'Ads Moderation'}
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={modSections.memberships}
                          onChange={e => setModSections({ ...modSections, memberships: e.target.checked })}
                          style={{ accentColor: '#008b5e', cursor: 'pointer' }}
                        />
                        📦 {lang === 'bn' ? 'মেম্বারশিপ অফার' : 'Membership Offers'}
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={modSections.gateways}
                          onChange={e => setModSections({ ...modSections, gateways: e.target.checked })}
                          style={{ accentColor: '#008b5e', cursor: 'pointer' }}
                        />
                        ⚙️ {lang === 'bn' ? 'পেমেন্ট গেটওয়ে' : 'Payment Gateways'}
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={modSections.payment_info}
                          onChange={e => setModSections({ ...modSections, payment_info: e.target.checked })}
                          style={{ accentColor: '#008b5e', cursor: 'pointer' }}
                        />
                        🔔 {lang === 'bn' ? 'পেমেন্ট ইনফো' : 'Payment Info'}
                      </label>

                       <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={modSections.users}
                          onChange={e => setModSections({ ...modSections, users: e.target.checked })}
                          style={{ accentColor: '#008b5e', cursor: 'pointer' }}
                        />
                        🛡️ {lang === 'bn' ? 'ইউজার মেম্বারশিপ' : 'User Memberships'}
                      </label>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={modSections.support}
                          onChange={e => setModSections({ ...modSections, support: e.target.checked })}
                          style={{ accentColor: '#008b5e', cursor: 'pointer' }}
                        />
                        💬 {lang === 'bn' ? 'লাইভ কাস্টমার সাপোর্ট' : 'Live Support'}
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {modEditingEmail && (
                      <button
                        type="button"
                        onClick={() => {
                          setModEditingEmail(null);
                          setModName('');
                          setModEmail('');
                          setModSections({
                            ads: true,
                            memberships: true,
                            gateways: true,
                            payment_info: true,
                            users: true,
                            support: true,
                          });
                        }}
                        style={{
                          flex: 1, padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1',
                          background: 'white', color: '#475569', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer'
                        }}
                      >
                        {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        if (!modName || !modEmail) return;
                        confirmAction(
                          modEditingEmail ? 'মডারেটর তথ্য আপডেট করবেন?' : 'মডারেটর যোগ করবেন?',
                          modEditingEmail ? 'Update Moderator?' : 'Add Moderator?',
                          'আপনি কি নিশ্চিত যে এই পরিবর্তনটি সেভ করতে চান?', 'Are you sure you want to save this change?',
                          () => handleAddModerator(e)
                        );
                      }}
                      style={{
                        flex: 2, padding: '0.55rem', borderRadius: '8px', border: 'none',
                        background: '#008b5e', color: 'white', fontWeight: 800, fontSize: '0.78rem',
                        cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,139,94,0.2)'
                      }}
                    >
                      {modEditingEmail ? (lang === 'bn' ? 'তথ্য আপডেট করুন' : 'Update Info') : (lang === 'bn' ? 'মডারেটর যোগ করুন' : 'Add Moderator')}
                    </button>
                  </div>
                </form>
              </div>

              {/* Registered list column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e293b', margin: '0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {lang === 'bn' ? 'নিবন্ধিত মডারেটরবৃন্দ' : 'Registered Moderators'} ({moderators.length})
                </h4>

                {moderators.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '3.5rem 1.5rem', background: '#f8fafc',
                    borderRadius: '14px', border: '1.5px dashed #cbd5e1', color: '#64748b', fontSize: '0.8rem', fontWeight: 500
                  }}>
                    🛡️ {lang === 'bn' ? 'এখনো কোনো মডারেটর যুক্ত করা হয়নি!' : 'No moderators added yet!'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {moderators.map((mod) => (
                      <div key={mod.email} style={{
                        background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px',
                        padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.01)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 850, color: '#0f172a', fontSize: '0.88rem' }}>
                              {mod.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.1rem', wordBreak: 'break-all' }}>
                              ✉ {mod.email}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button
                              onClick={() => handleEditModeratorClick(mod)}
                              style={{
                                background: '#f1f5f9', border: 'none', borderRadius: '6px',
                                padding: '0.3rem 0.5rem', color: '#0284c7', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer'
                              }}
                            >
                              {lang === 'bn' ? 'এডিট' : 'Edit'}
                            </button>
                            <button
                              onClick={() => confirmAction(
                                'মডারেটর মুছে ফেলবেন?', 'Delete Moderator?',
                                'এই মডারেটরটি স্থায়ীভাবে মুছে ফেলা হবে।', 'This moderator will be permanently deleted.',
                                () => handleDeleteModerator(mod.email),
                                true
                              )}
                              style={{
                                background: '#fef2f2', border: 'none', borderRadius: '6px',
                                padding: '0.3rem 0.5rem', color: '#dc2626', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer'
                              }}
                            >
                              {lang === 'bn' ? 'মুছুন' : 'Delete'}
                            </button>
                          </div>
                        </div>

                        {/* Badges of allowed panels */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.2rem' }}>
                          {mod.allowed_sections?.map(sec => {
                            let label = sec;
                            let color = '#475569';
                            let bg = '#f1f5f9';
                            if (sec === 'ads') {
                              label = lang === 'bn' ? '📢 অ্যাড মডারেশন' : '📢 Ads';
                              color = '#be123c';
                              bg = '#fff1f2';
                            } else if (sec === 'memberships') {
                              label = lang === 'bn' ? '📦 মেম্বারশিপ অফার' : '📦 Membership';
                              color = '#c2410c';
                              bg = '#fff7ed';
                            } else if (sec === 'gateways') {
                              label = lang === 'bn' ? '⚙️ পেমেন্ট গেটওয়ে' : '⚙️ Gateways';
                              color = '#0369a1';
                              bg = '#f0f9ff';
                            } else if (sec === 'payment_info') {
                              label = lang === 'bn' ? '🔔 পেমেন্ট ইনফো' : '🔔 Payments';
                              color = '#15803d';
                              bg = '#f0fdf4';
                            } else if (sec === 'users') {
                              label = lang === 'bn' ? '🛡️ ইউজার মেম্বারশিপ' : '🛡️ Users';
                              color = '#6d28d9';
                              bg = '#faf5ff';
                            } else if (sec === 'support') {
                              label = lang === 'bn' ? '💬 লাইভ সাপোর্ট' : '💬 Support';
                              color = '#008b5e';
                              bg = '#e6f7f0';
                            }

                            return (
                              <span key={sec} style={{
                                background: bg, color: color, fontSize: '0.65rem', fontWeight: 800,
                                padding: '0.15rem 0.4rem', borderRadius: '6px', border: `1px solid ${bg}`
                              }}>
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Customer Support Customization tab content */}
        {activeTab === 'support_settings' && isTabAllowed('support') && (
          <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.03)', padding: '2rem' }}>
            
            {/* Customization Settings Form */}
            <div style={{ paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ⚙️ {lang === 'bn' ? 'কাস্টমার সাপোর্ট সেটিংস কাস্টমাইজেশন' : 'Customer Support Customization'}
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                {lang === 'bn' ? 'এখান থেকে আপনি ইউজারদের কাস্টমার সাপোর্ট অপশনগুলো (হোয়াটসঅ্যাপ, ইমেইল, সময়সূচী) কাস্টমাইজ করতে পারবেন।' : 'Configure custom communication options and support timings shown to users.'}
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>{lang === 'bn' ? 'সাপোর্ট ইমেইল' : 'Support Email'}</label>
                  <input 
                    type="email" 
                    value={supportEmail} 
                    onChange={e => setSupportEmail(e.target.value)} 
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>{lang === 'bn' ? 'হোয়াটসঅ্যাপ নাম্বার' : 'WhatsApp Number'}</label>
                  <input 
                    type="text" 
                    value={supportWhatsapp} 
                    onChange={e => setSupportWhatsapp(e.target.value)} 
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                    placeholder="e.g. 8801700000000"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>{lang === 'bn' ? 'হোয়াটসঅ্যাপ ডিফল্ট মেসেজ' : 'WhatsApp Default Message'}</label>
                  <input 
                    type="text" 
                    value={supportWhatsappText} 
                    onChange={e => setSupportWhatsappText(e.target.value)} 
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>{lang === 'bn' ? 'সাপোর্ট শুরুর সময়' : 'Support Start Time'}</label>
                  <input 
                    type="time" 
                    value={supportHoursStart} 
                    onChange={e => setSupportHoursStart(e.target.value)} 
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>{lang === 'bn' ? 'সাপোর্ট শেষ সময়' : 'Support End Time'}</label>
                  <input 
                    type="time" 
                    value={supportHoursEnd} 
                    onChange={e => setSupportHoursEnd(e.target.value)} 
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.2rem' }}>
                  <input 
                    type="checkbox" 
                    id="liveChatEnabled"
                    checked={supportLiveChatEnabled} 
                    onChange={e => setSupportLiveChatEnabled(e.target.checked)} 
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="liveChatEnabled" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>{lang === 'bn' ? 'লাইভ চ্যাট সক্রিয় করুন' : 'Enable Live Chat Channel'}</label>
                </div>
              </div>
              <button 
                onClick={handleSaveSupportSettings} 
                disabled={savingSupportSettings}
                style={{ background: '#008b5e', color: 'white', border: 'none', borderRadius: '8px', padding: '0.7rem 1.5rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}
              >
                {savingSupportSettings ? (lang === 'bn' ? 'সংরক্ষণ করা হচ্ছে...' : 'Saving...') : (lang === 'bn' ? 'সেটিংস সংরক্ষণ করুন' : 'Save Support Config')}
              </button>
            </div>
          </div>
        )}

        {/* Live Support Support desk tab content */}
        {activeTab === 'support' && isTabAllowed('support') && (
          <div className={styles.supportTabCard}>
            
            {/* Live Chat Sessions Section */}
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                💬 {lang === 'bn' ? 'সাপোর্ট লাইভ চ্যাট রুম' : 'Live Support Chat Rooms'}
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                {lang === 'bn' ? 'গ্রাহকদের সমস্যা সমাধানে সরাসরি তাদের সাথে এখানে লাইভ চ্যাট করুন।' : 'Respond to user queries instantly by chatting live with them below.'}
              </p>
              
              <div className={styles.supportLayoutContainer}>
                
                {/* Support Chat List */}
                <div className={styles.supportSidebar}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{lang === 'bn' ? 'চলমান চ্যাটসমূহ' : 'Active Sessions'}</strong>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => setFilterUnreadSupport(!filterUnreadSupport)} 
                        style={{ padding: '0.2rem 0.4rem', borderRadius: '6px', border: 'none', background: filterUnreadSupport ? '#ef4444' : '#f1f5f9', color: filterUnreadSupport ? 'white' : '#64748b', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600 }}
                        title={lang === 'bn' ? 'শুধুমাত্র আনরিড মেসেজগুলো দেখুন' : 'Show Unread Only'}
                      >
                        {lang === 'bn' ? 'আনসিন' : 'Unseen'}
                      </button>
                      <button 
                        onClick={fetchSupportChats} 
                        style={{ padding: '0.2rem', borderRadius: '6px', border: 'none', background: 'transparent', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title={lang === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {supportChats.filter(c => filterUnreadSupport ? c.unreadCount > 0 : true).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {lang === 'bn' ? 'কোনো চ্যাট সেশন পাওয়া যায়নি' : 'No active support chats.'}
                      </div>
                    ) : (
                      supportChats.map(c => {
                        const isSelected = selectedSupportChat?.id === c.id;
                        return (
                          <div 
                            key={c.id} 
                            onClick={() => handleSelectSupportChat(c)}
                            style={{ padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', background: isSelected ? '#f1f5f9' : 'transparent', cursor: 'pointer', transition: 'background 0.2s' }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {c.user?.full_name || 'User'}
                                {activeUsers.has(c.user_id) && (
                                  <span style={{ fontSize: '0.65rem', background: '#10b981', color: 'white', padding: '0.1rem 0.35rem', borderRadius: '8px', fontWeight: 'bold' }}>
                                    {lang === 'bn' ? 'অ্যাক্টিভ' : 'Active'}
                                  </span>
                                )}
                                {c.unreadCount > 0 && (
                                  <span style={{ background: '#ef4444', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>
                                    {c.unreadCount}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.user?.email}
                            </div>
                            {c.lastMsg && (
                              <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic', fontWeight: c.unreadCount > 0 ? 800 : 400 }}>
                                {c.lastMsg.content}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Support Message Window */}
                <div className={styles.supportChatWindow}>
                  {selectedSupportChat ? (
                    <>
                      {/* Window Header */}
                      <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                        <div>
                          <strong style={{ color: '#1e293b' }}>{selectedSupportChat.user?.full_name}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>({selectedSupportChat.user?.email})</span>
                          {activeUsers.has(selectedSupportChat.user_id) && (
                            <span style={{ fontSize: '0.65rem', background: '#10b981', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '8px', fontWeight: 'bold', marginLeft: '0.5rem' }}>
                              {lang === 'bn' ? 'অ্যাক্টিভ' : 'Active'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Messages Area */}
                      <div ref={adminSupportMessagesRef} style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', background: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {supportMessages.map((m, idx) => {
                          const isOwn = m.sender_id !== selectedSupportChat.user_id;
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start', width: '100%' }}>
                              <div style={{
                                maxWidth: '75%', padding: '0.65rem 0.85rem', borderRadius: '10px', fontSize: '0.88rem', lineHeight: 1.4,
                                background: isOwn ? '#008b5e' : 'white',
                                color: isOwn ? 'white' : '#1e293b',
                                border: isOwn ? 'none' : '1px solid #cbd5e1',
                                borderTopRightRadius: isOwn ? '2px' : '10px',
                                borderTopLeftRadius: isOwn ? '10px' : '2px',
                              }}>
                                {m.image_url && (
                                  <div style={{ marginBottom: '0.4rem', borderRadius: '8px', overflow: 'hidden', maxWidth: '240px' }}>
                                    <img 
                                      src={m.image_url} 
                                      alt="Support Attachment" 
                                      style={{ width: '100%', display: 'block', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} 
                                      onClick={() => window.open(m.image_url, '_blank')} 
                                    />
                                  </div>
                                )}
                                {m.content && <div>{m.content}</div>}
                                <span style={{ display: 'block', fontSize: '0.65rem', marginTop: '0.25rem', opacity: 0.8, textAlign: 'right' }}>
                                  {getRelativeTime(m.created_at, lang)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* End Chat Session action bar */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.35rem 0.75rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <button
                          type="button"
                          onClick={handleAdminEndChat}
                          disabled={sendingSupportMsg}
                          style={{
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            padding: '0.25rem 0.65rem',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            transition: 'all 0.2s',
                          }}
                        >
                          ❌ {lang === 'bn' ? 'চ্যাট শেষ করুন' : 'End Support Chat'}
                        </button>
                      </div>

                      {/* Input Form */}
                      <form onSubmit={handleSendSupportMsg} style={{ padding: '0.75rem', display: 'flex', borderTop: '1px solid #e2e8f0', gap: '0.5rem', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', padding: '0 0.5rem' }}>
                          <input 
                            type="file" 
                            hidden 
                            accept=".jpg,.jpeg,.png,.webp" 
                            onChange={handleAdminSupportImageUpload} 
                            disabled={sendingSupportMsg} 
                          />
                          <Camera size={22} />
                        </label>
                        <input 
                          type="text" 
                          placeholder={lang === 'bn' ? 'উত্তর লিখুন...' : 'Type a reply...'} 
                          ref={adminSupportInputRef}
                          value={newSupportMessage}
                          onChange={e => setNewSupportMessage(e.target.value)}
                          style={{ flex: 1, padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                        />
                        <button 
                          type="submit" 
                          disabled={sendingSupportMsg || (!newSupportMessage.trim())}
                          style={{ background: '#008b5e', border: 'none', borderRadius: '8px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justify: 'center', color: 'white', cursor: 'pointer' }}
                        >
                          <Send size={18} />
                        </button>
                      </form>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👋</div>
                      <h3>{lang === 'bn' ? 'লাইভ চ্যাট উইন্ডো' : 'Support Live Desk'}</h3>
                      <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{lang === 'bn' ? 'বার্তা আদান-প্রদান করতে যেকোনো একটি চ্যাট সেশন নির্বাচন করুন।' : 'Select a user support chat from the left panel to begin replying.'}</p>
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
