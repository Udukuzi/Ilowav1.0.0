export interface RadioStation {
  id: string;
  name: string;
  region: string;
  streamUrl: string;
  isLive: boolean;
  currentDJ?: DJ;
  listenerCount: number;
  schedule: RadioScheduleSlot[];
}

export interface DJ {
  id: string;
  name: string;
  avatar: string;
  wallet: string;
  totalTips: number;
  genre: string;
}

export interface RadioScheduleSlot {
  id: string;
  djId: string;
  djName: string;
  startTime: string;
  endTime: string;
  title: string;
  genre: string;
  isLive: boolean;
}

export interface Podcast {
  id: string;
  title: string;
  description: string;
  audioUri: string;
  duration: number;
  language: string;
  region: string;
  narrator: string;
  coverImage: string;
  publishedAt: number;
}

export interface BrowseStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  language: string;
  votes: number;
  bitrate: number;
  codec: string;
  clickcount: number;
  clicktrend?: number;
  lastcheckok: number;
}

export interface CallInRequest {
  id: string;
  userId: string;
  audioUri: string;
  transcription?: string;
  status: 'queued' | 'approved' | 'aired' | 'rejected';
  stationId: string;
  timestamp: number;
}
