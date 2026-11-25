'use client';

import { useEffect, useState } from 'react';
import SiteStats from '@/components/admin/analytics/SiteStats';
import GoogleStats from '@/components/admin/analytics/GoogleStats';
import { IconChart, IconSearch } from '@/components/admin/icons';
import './istatistik.css';

// İstatistikler: iki sekme. "Site verileri" kendi anonim sayacımız; "Google Arama" Search Console.
type Tab = 'site' | 'google';

export default function IstatistikPage() {
  const [tab, setTab] = useState<Tab>('site');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'google') setTab('google');
  }, []);

  const pick = (t: Tab) => {
    setTab(t);
    const url = new URL(window.location.href);
    if (t === 'google') url.searchParams.set('tab', 'google'); else url.searchParams.delete('tab');
    window.history.replaceState(null, '', url.toString());
  };

  return (
    <div className="st-page">
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">İstatistikler</h1>
          <p className="adm-page-sub">{tab === 'site' ? 'Sitemize gelen ziyaretçiler · Türkiye saati' : 'Google aramalarında görünürlüğümüz · Search Console'}</p>
        </div>
      </div>

      <div className="st-maintabs" role="tablist">
        <button role="tab" aria-selected={tab === 'site'} className={tab === 'site' ? 'on' : ''} onClick={() => pick('site')}>
          <span className="st-maintab-title"><IconChart size={18} /> Site verileri</span><small>ziyaretçi, ürün, kaynak</small>
        </button>
        <button role="tab" aria-selected={tab === 'google'} className={tab === 'google' ? 'on' : ''} onClick={() => pick('google')}>
          <span className="st-maintab-title"><IconSearch size={18} /> Google Arama</span><small>kelimeler, tıklama, sıra</small>
        </button>
      </div>

      {tab === 'site' ? <SiteStats /> : <GoogleStats />}
    </div>
  );
}
