const Vec3 = require('tera-vec3');

let {
	DungeonInfo, Baharr, Baharr_TipMsg,
	 DW_BOSS_1,  DW_BOSS_2, DW_TipMsg1, DW_TipMsg2,
	 RM_BOSS_1,  RM_BOSS_2,  RM_BOSS_3,
	 VS_BOSS_1,  VS_BOSS_2,  VS_BOSS_3, VS_TipMsg,
	 RK_BOSS_1,  RK_BOSS_2,  RK_BOSS_3, RK_TipMsg,
	 RR_BOSS_1,  RR_BOSS_2,  RR_BOSS_3,
	 AA_BOSS_1,  AA_BOSS_2,  AA_BOSS_3,
	DRC_BOSS_1, DRC_BOSS_2, DRC_BOSS_3, DRC_TipMsg,
	GLS_BOSS_1, GLS_BOSS_2, GLS_BOSS_3,
	 GV_BOSS_1,  GV_BOSS_2
} = require('./boss');

module.exports = function Tera_Guide(mod) {
	let Enabled            =  true, // 总开关
		SendToParty        = false, // true 真实[组队频道]通知, false采用虚假通知
		SendToStream       = false, // true 关闭两种队长通知, 并将消息发送到聊天[代理]频道
		BossLog            = false,
		debug              = false,
		itemID1            =     3, // 告示牌: 1一般布告栏, 2兴高采烈布告栏, 3狂人布告栏
		itemID2            = 98260, // 战利品: 古龍貝勒古斯的頭 (光柱), 369: 鑽石
		itemID3            =   445, // 采集物: 445艾普罗
		itemID4            =   413, // 采集物: 413调味草
		itemID5            =   513, // 采集物: 513吞食之草
		itemID6            =   912  // 采集物: 912鸵鸟蛋
	// 定义变量
	let hooks              = [],
		isTank             = false, // 坦克职业 / 打手职业
		whichzone          = 0,     // 登陆地区(zone)
		whichmode          = 0,     // 副本地图(huntingZoneId)
		whichboss          = 0,     // 区域位置(templateId)
		boss_HP            = 0,     // BOSS 血量
		boss_GameID        = 0n,    // BOSS gameId
		boss_CurLocation   = {},    // BOSS 坐标
		boss_CurAngle      = 0,     // BOSS 角度
		uid1      = 999999999n,     // 告示牌UID
		uid2      = 899999999n,     // 龙头UID
		uid3      = 799999999n,     // 花朵UID
		curLocation        = {},    // 地面提示 坐标 x y z
		curAngle           = 0,     // 地面提示 角度
		// DW
		circleCount        = 0,     // 累计点名圆圈数
		ballColor          = 0,     // 打投掷颜色
		// VS
		checked            = false, // 鉴定
		inverted           = false, // 恢复正常 / 进入灵魂
		nextMsg            = 0,     // 预告下一次[鉴定消息数组]角标
		// RK
		ballCount          = 1,     // 出球数
		timer              = 5000;  // 提示物显示时间
		FirstMsg           = "X",   // 第一技能
		SecondMsg          = "X",   // 第二技能
		SwitchMsg          = false, // 正常顺序 / 反向顺序
		// AA
		lastTwoUpDate      = 0,
		lastRotationDate   = 0,
		rotationDelay      = 0,
		// GLS
		sign_CurLocation   = {},    // 水波石碑 坐标
		sign_CurAngle      = 0,     // 水波石碑 角度
		power              = false, // 充能计数
		Level              = 0,     // 充能层数
		levelMsg           = [],    // 充能文字 数组
		powerMsg           = '';    // 充能文字
	// 控制命令
	mod.command.add(["辅助", "guide"], (arg) => {
		if (!arg) {
			Enabled = !Enabled;
			mod.command.message("辅助提示(Guide) " + (Enabled ? "启用(ON)" : "禁用(OFF)"));
		} else {
			switch (arg) {
				case "party":
				case "组队":
					SendToParty = !SendToParty;
					mod.command.message("发送通知(SendTo) " + (SendToParty ? "组队(Party)" : "自己(Self)"));
					break;
				case "stream":
				case "主播":
					SendToStream = !SendToStream;
					mod.command.message("主播模式(Stream) " + (SendToStream ? "启用(ON)" : "禁用(OFF)"));
					break;
				case "debug":
					mod.command.message("模块开关: " + Enabled);
					mod.command.message("发送通知 " + (SendToParty  ? "真实组队" : "仅自己见"));
					mod.command.message("主播模式 " + (SendToStream ? "启用" : "禁用"));
					mod.command.message("职业分类 " + (isTank       ? "坦克" : "打手"));
					mod.command.message("Boss-Log " + (BossLog      ? "ON" : "OFF"));
					mod.command.message("登陆地区: " + whichzone);
					mod.command.message("副本地图: " + whichmode);
					mod.command.message("区域位置: " + whichboss);
					sendMessage("test");
					debug = !debug;
					mod.command.message("Debug: " + (debug ? "On" : " Off"));
					break;
				case "log":
					BossLog = !BossLog;
					mod.command.message("Boss-Log: " + (BossLog ? "ON" : "OFF"));
					break;
				default :
					mod.command.message("无效的参数!");
					break;
			}
		}
	});
	// 登陆游戏
	mod.game.on('enter_game', () => {
		var job = (mod.game.me.templateId - 10101) % 100;
		if (job === 1 || job === 10) { // 0-双刀, 1-枪骑, 2-大剑, 3-斧头, 4-魔道
			isTank = true;             // 5-弓箭, 6-祭司, 7-元素, 8-飞镰, 9-魔工
		} else {                       // 10-拳师, 11-忍者 12 月光
			isTank = false;
		}
	})
	// 切换场景
	mod.game.me.on('change_zone', (zone, quick) => {
		whichzone = zone;
		var dungeonInfo;
		
		if (dungeonInfo = DungeonInfo.find(obj => obj.zone === whichzone)) {
			mod.command.message("进入副本 " + dungeonInfo.string);
			load();
		} else {
			whichmode = 0;
			whichboss = 0;
			unload();
		}
	})
	
	function load() {
		if (!hooks.length) {
			hook('S_BOSS_GAGE_INFO',        3, sBossGageInfo);
			hook('S_SPAWN_NPC',            11, sSpawnNpc);
			hook('S_CREATURE_ROTATE',       2, sCreatureRotate);
			hook('S_DUNGEON_EVENT_MESSAGE', 2, sDungeonEventMessage);
			hook('S_QUEST_BALLOON',         1, sQuestBalloon);
			hook('S_ACTION_STAGE',          9, sActionStage);
		}
	}
	
	function hook() {
		hooks.push(mod.hook(...arguments));
	}
	
	function unload() {
		if (hooks.length) {
			for (let h of hooks)
				mod.unhook(h);
			hooks = [];
		}
		reset();
	}
	
	function reset() {
		// 清除所有定时器
		mod.clearAllTimeouts();
		// DW
		circleCount        = 0,
		ballColor          = 0;
		// RK_2王
		ballCount          = 1,
		timer              = 5000;
		// RK_3王
		FirstMsg           = "X",
		SecondMsg          = "X",
		SwitchMsg          = false,
		// VS_3王
		checked            = false,
		inverted           = false,
		nextMsg            = 0,
		// GLS_3王
		power              = false,
		Level              = 0,
		levelMsg           = [],
		powerMsg           = '';
	}
	
	function sBossGageInfo(event) {
		whichmode = event.huntingZoneId;
		whichboss = event.templateId;
		boss_HP = (Number(event.curHp) / Number(event.maxHp));
		
		if (boss_HP <= 0) {
			whichboss = 0;
			reset();
		}
		if (boss_HP == 1) {
			reset();
		}
	}
	
	function sSpawnNpc(event) {
		// RK_2王 丢点名球
		if ([735, 935].includes(whichmode) && event.templateId===2007 && !SendToStream) {
			curLocation = event.loc;
			curAngle = event.w;
			if (whichmode==935) {
				if (ballCount===1) {
					timer = 10000;
					ballCount++;
				} else if (ballCount===2) {
					timer = 7000
					ballCount++;
				} else if (ballCount===3) {
					timer = 4000;
					ballCount = 1;
				}
			}
			SpawnString(itemID3, timer,   0, 1000);
			SpawnString(itemID3, timer,  90,  600);
			SpawnString(itemID3, timer, 180, 1000);
			SpawnString(itemID3, timer, 270,  600);
		}
	}
	
	function sCreatureRotate(event) {
		// AA_3王 后砸
		if (lastTwoUpDate && boss_GameID == event.gameId) {
			lastRotationDate = Date.now();
			rotationDelay = event.time;
		}
	}
	
	function sDungeonEventMessage(event) {
		if (!Enabled || whichmode==0 || whichboss==0) return;
		var msg_Id = parseInt(event.message.replace(/[^0-9]/ig, '') % 1000);
		// var msg_Id = parseInt(event.message.replace('@dungeon:', '') % 1000);
		if (BossLog) {
			mod.command.message("Dungeon-Message: " + event.message + " | " + msg_Id);
		}
		
		// DRC_1王 能量满100提醒
		if ([783, 983, 3018].includes(whichmode) && whichboss==1000 && msg_Id===103) {
			sendMessage(DRC_TipMsg[0]); // 下级-9783103 上级-9983103
		}
		// VS_3王 翻译王说话(鉴定提示)
		if ([781, 981].includes(whichmode) && whichboss==3000) {
			if ([43, 44, 45].includes(msg_Id)) {
				// 1 注 - 9781043 9981043  2 闪 - 9781044 9981044  3 炸 - 9781045 9981045
				nextMsg = msg_Id % 42;
				if (inverted) nextMsg += 3;
				sendMessage((VS_TipMsg[0] + VS_TipMsg[nextMsg]), 25);
			}
		}
		// RK_3王 上级鉴定
		if (whichmode===935 && whichboss==3000) {
			// 传送协议  近- 9935302 远- 9935303 全- 9935304
			if ([302, 303, 304].includes(msg_Id)) {
				FirstMsg = RK_TipMsg[msg_Id % 301];
			}
			// 变更协议-绿  9935311
			if (msg_Id===311) {
				SwitchMsg = false;
				sendMessage((RK_TipMsg[0] + FirstMsg + " + " + SecondMsg), 25);
			}
			// 变更协议-红  9935312
			if (msg_Id===312) {
				SwitchMsg = true;
				sendMessage((RK_TipMsg[0] + SecondMsg + " + " + FirstMsg), 25);
			}
		}
		
	}
	
	function sQuestBalloon(event) {
		if (!Enabled || whichmode==0 || whichboss==0) return;
		var msg_Id = parseInt(event.message.replace(/[^0-9]/ig, '') % 1000);
		// var msg_Id = parseInt(event.message.replace('@monsterBehavior:', '') % 1000);
		if (BossLog) {
			mod.command.message("Quest-Balloon: " + event.message + " | " + msg_Id);
		}
		
		// DW_2王 球颜色(王的说话)
		if (whichmode==466 && whichboss===46602) {
			// 逆-466054 [红色] 顺-466050 | 逆-466055 [白色] 顺-466051 | 逆-466056 [蓝色] 顺-466052
			if ([50, 51, 52, 54, 55, 56].includes(msg_Id)) {
			//    1   2   3   5   6   7
				ballColor = msg_Id % 49;
				sendMessage((DW_TipMsg2[0] + DW_TipMsg2[ballColor]), 25);
			}
		}
		// VS_3王 鉴定
		if ([781, 981].includes(whichmode) && whichboss==3000) {
			// 死于混乱之中吧 - 开始鉴定 - 78142
			if (msg_Id===142) {
				checked = true;
				mod.setTimeout(() => { checked = false; }, 1000);
				
				if (boss_HP > 0.5) {
					nextMsg = nextMsg+1;
					if (!inverted && nextMsg>3) nextMsg = 1; // VS_TipMsg[1] - VS_TipMsg[2] - VS_TipMsg[3]
					if ( inverted && nextMsg>6) nextMsg = 4; // VS_TipMsg[4] - VS_TipMsg[5] - VS_TipMsg[6]
				} else {
					nextMsg = nextMsg-1;
					if (!inverted && nextMsg<1) nextMsg = 3; // 1注(近)-2闪(分)-3炸(解)
					if ( inverted && nextMsg<4) nextMsg = 6; // 4注(远)-5闪(集)-6炸(不)
				}
				mod.setTimeout(() => {
					sendMessage((VS_TipMsg[0] + VS_TipMsg[nextMsg]), 25);
				}, 5000);
			}
			// 进入灵魂 - 78151
			if (msg_Id===151) {
				inverted = true;
				nextMsg = nextMsg+3;
				sendMessage(("Into -> " + VS_TipMsg[nextMsg]), 25);
			}
			// 挺能撑的 - 78152
			if (msg_Id===152) {
				inverted = false;
				nextMsg = nextMsg-3;
				sendMessage(("Out  -> " + VS_TipMsg[nextMsg]), 25);
			}
			// if (msg_Id===55) mod.command.message("在神的面前不要掉以轻心");
		}
		// RK_3王 上级鉴定
		if (whichmode===935 && whichboss==3000) {
			// 执行协议-935300  近-935301 远-935302 全-935303
			if ([301, 302, 303].includes(msg_Id)) {
				SecondMsg = RK_TipMsg[msg_Id % 300];
				SpawnCircle(itemID3, 5000, 8, 300);
				
				// SwitchMsg - false(绿) / true(红)
				if (!SwitchMsg) {
					sendMessage(FirstMsg + " -> " + SecondMsg);
					
					FirstMsg = SecondMsg;
					SecondMsg = "X";
					mod.setTimeout(() => {
						sendMessage((RK_TipMsg[0] + FirstMsg + " -> " + SecondMsg), 25);
					}, 6500);
				} else {
					sendMessage(SecondMsg + " -> " + FirstMsg);
					
					FirstMsg = SecondMsg;
					SecondMsg = "X";
					mod.setTimeout(() => {
						sendMessage((RK_TipMsg[0] + SecondMsg + " -> " + FirstMsg), 25);
					}, 6500);
				}
			}
		}
		
	}
	
	function sActionStage(event) {
		// 模块关闭 或 不在副本中 或 找不到BOSS血条
		if (!Enabled || whichmode==0 || whichboss==0) return;
		
		// GLS_2 石碑 水波攻击 范围提示
		if ([782, 982, 3019].includes(whichmode) && [2021, 2022, 2023].includes(event.templateId)) {
			var sign_skillid = event.skill.id % 1000; // 石碑攻击技能编号简化
			sign_CurLocation = event.loc;             // 石碑的 x y z 坐标
			sign_CurAngle = event.w;                  // 石碑的角度
			
			var	sign_X = sign_CurLocation.x - boss_CurLocation.x,               // 石碑与王 X坐标之差
				sign_Y = sign_CurLocation.y - boss_CurLocation.y,               // 石碑与王 Y坐标之差
				sign_Radius = Math.pow((sign_X*sign_X) + (sign_Y*sign_Y), 0.5); // 勾股定理: C等于(A平方+B平方)的1/2次幂
			
			curLocation = sign_CurLocation; // 传递石碑坐标参数
			curAngle = sign_CurAngle;       // 传递石碑角度参数
			
			if (sign_skillid===302||sign_skillid===306||sign_skillid===303||sign_skillid===307) {
				SpawnCircle(itemID4, 7000, 6, sign_Radius); // 构造圆形花圈 石碑到王的距离为 [半径]
			}
		}
		// GLS_3 接电石碑 队员间隔
		if ([782, 982, 3019].includes(whichmode) && event.templateId==3022 && event.skill.id==1101) {
			// 3王回地图中间点的 (x, y) 坐标
			boss_CurLocation.x = -95703;
			boss_CurLocation.y = 144980;
			// 上级HP<40% 较短一侧石碑到王 提示跳过
			var X = Math.pow((boss_CurLocation.x - event.loc.x), 2),
				Y = Math.pow((boss_CurLocation.y - event.loc.y), 2),
				C = Math.pow(X+Y, 0.5);
			if (C < 500) return;
			// 石碑的坐标/角度 设定为提示物初始点
			curLocation = event.loc;
			curAngle = event.w;
			// 4圈 1直线
			SpawnCircle(itemID4, 8000,  15, 105);
			SpawnCircle(itemID4, 8000,  12, 210);
			SpawnCircle(itemID4, 8000,  10, 315);
			SpawnCircle(itemID4, 8000,   8, 420);
			SpawnString(itemID6, 8000, 180, 440);
		}
		
		// 巴哈勒 - 红眼射线
		/* if (whichmode===444 && event.templateId==2500 && event.skill.id===2201) {
			sendMessage(("红眼射线 (激活)"), 25);
		} */
		if (whichmode===444 && event.templateId==2500 && event.skill.id===2305) {
			if (event.stage!==0) return;
			curLocation = event.loc;
			curAngle = event.w;
			SpawnString(itemID6, 180, 3000, 4000);
			sendMessage(Baharr_TipMsg[1], 25);
		}
		
		
		if (event.templateId!==whichboss) return;
		if (BossLog) {
			mod.command.message("Boss-Skill: " + whichmode + "_" + whichboss + "_" + event.skill.id + "_" + event.stage);
		}
		
		var bossSkillID;
		var skillid = event.skill.id % 1000; // 攻击技能编号简化 取1000余数运算
		boss_CurLocation = event.loc;        // BOSS的 x y z 坐标
		boss_CurAngle = event.w;             // BOSS的角度
		boss_GameID = event.gameId;          // BOSS gameId
		curLocation = boss_CurLocation;      // 传递BOSS坐标参数
		curAngle = boss_CurAngle;            // 传递BOSS角度参数
		
		// DW_1王
		if (whichmode==466 && event.templateId==46601 && (bossSkillID = DW_BOSS_1.find(obj => obj.id === skillid))) {
			// BOSS HP > 50%  +1圈 +2圈 +3圈 +4圈 +5圈
			if ([306, 307, 308, 309, 310].includes(skillid)) {
				circleCount += skillid % 305;
				sendMessage((bossSkillID.msg + "=" + circleCount + " | " + DW_TipMsg1[circleCount % 2]), 25);
				return;
			}
			// BOSS HP < 50%  +1圈 +2圈 +3圈 +4圈 +5圈
			if ([319, 320, 321, 322, 323].includes(skillid)) {
				circleCount += skillid % 318;
				sendMessage((bossSkillID.msg + "=" + circleCount + " | " + DW_TipMsg1[circleCount % 2]), 25);
				return;
			}
			// 鉴定-出圈 重置圈数
			if ([311, 315, 313, 317].includes(skillid) || [312, 316, 314, 318].includes(skillid)) {
				circleCount = 0;
			}
			sendMessage(bossSkillID.msg);
		}
		// DW_2王
		if (whichmode==466 && event.templateId==46602 && (bossSkillID = DW_BOSS_2.find(obj => obj.id === skillid))) {
			if (event.stage!==0) return;
			// 举球 内外圈 (开场 / 30%重新进场)
			if (skillid===309||skillid===310) {
				ballColor = 4;
			}
			// 举球 内外圈
			if ([311, 314, 312, 313].includes(skillid)) {
				SpawnCircle(itemID3, 5000, 10, 320);
			}
			// 鉴定 打投掷
			if (skillid===303) {
				sendMessage(bossSkillID.msg + " -> " + DW_TipMsg2[ballColor]);
				return;
			}
			sendMessage(bossSkillID.msg);
		}
		
		// RM_1王
		if ([770, 970].includes(whichmode) && event.templateId==1000 && (bossSkillID = RM_BOSS_1.find(obj => obj.id === skillid))) {
			// 前喷
			if (skillid===107) {
				SpawnString(itemID3, 3000, 130, 500);
				SpawnString(itemID3, 3000, 230, 500);
			}
			sendMessage(bossSkillID.msg);
		}
		// RM_2王
		if ([770, 970].includes(whichmode) && event.templateId==2000 && (bossSkillID = RM_BOSS_2.find(obj => obj.id === skillid))) {
			//插地眩晕
			if (skillid===106) {
				SpawnThing(   false,  100, 180,  30);
				SpawnCircle(itemID3, 2000,  18, 180);
			}
			// 直线攻击
			if (skillid===111) {
				SpawnString(itemID3, 3000, 180, 500);
			}
			sendMessage(bossSkillID.msg);
		}
		// RM_3王
		if ([770, 970].includes(whichmode) && event.templateId==3000 && (bossSkillID = RM_BOSS_3.find(obj => obj.id === skillid))) {
			// 前推坦
			if (skillid===106) {
				SpawnThing(   false, 100,    0,  30);
				SpawnString(itemID3, 2000, 140, 580);
				SpawnString(itemID3, 2000, 240, 580);
			}
			// 尾巴横扫
			if (skillid===110) {
				SpawnString(itemID3, 2000, 155, 580);
				SpawnString(itemID3, 2000, 205, 580);
				SpawnCircle(itemID3, 2000,   8, 580);
			}
			// 内外圈 出
			if (skillid===113) {
				SpawnCircle(itemID3, 3000, 20,  80);
				SpawnCircle(itemID3, 3000, 18, 150);
				SpawnCircle(itemID3, 3000, 12, 220);
				SpawnCircle(itemID3, 3000, 10, 290);
				SpawnCircle(itemID3, 3000,  8, 580);
			}
			// 内外圈 进
			if (skillid===116) {
				SpawnCircle(itemID3, 3000, 10, 290);
				SpawnCircle(itemID3, 3000,  8, 580);
			}
			// 命运圈
			if (skillid===322) {
				SpawnCircle(itemID3, 5000, 20, 240);
				SpawnCircle(itemID3, 5000, 12, 400);
				SpawnCircle(itemID3, 5000,  8, 580);
			}
			sendMessage(bossSkillID.msg);
		}
		
		// VS_1王
		if ([781, 981].includes(whichmode) && event.templateId==1000 && (bossSkillID = VS_BOSS_1.find(obj => obj.id === skillid))) {
			// 内外圈
			if (skillid===304) {
				SpawnThing(   false, 100,   0,  10);
				SpawnCircle(itemID3, 5000, 18, 290);
			}
			// 左/右刀
			if (skillid===401||skillid===402) {
				SpawnString(itemID3, 2000, 180, 500); // 垂直对称轴 头部
				SpawnString(itemID3, 2000,   0, 500); // 垂直对称轴 尾部
				SpawnThing(true, 2000, bossSkillID.sign_degrees, 250);
				if (isTank) bossSkillID.msg = bossSkillID.msg_tk;
			}
			sendMessage(bossSkillID.msg);
		}
		// VS_2王
		if ([781, 981].includes(whichmode) && event.templateId==2000 && (bossSkillID = VS_BOSS_2.find(obj => obj.id === skillid))) {
			if (event.stage!==0) return;
			sendMessage(bossSkillID.msg);
		}
		// VS_3王
		if ([781, 981].includes(whichmode) && event.templateId==3000 && (bossSkillID = VS_BOSS_3.find(obj => obj.id === skillid))) {
			if (event.stage!==0) return;
			if (skillid===103 && !checked) return;
			// 前盾砸(晕坦) / 甜甜圈
			if (skillid===116) {
				if (whichmode===781) { // 下级 前盾砸
					SpawnThing(   false,  100, 180,  30);
					SpawnString(itemID3, 5000, 120, 500);
					SpawnString(itemID3, 5000, 240, 500);
				} else { // 上级 甜甜圈
					SpawnThing(   false,  100, 180,  40);
					SpawnCircle(itemID3, 8000,  18, 200);
					SpawnCircle(itemID3, 8000,  15, 380);
					SpawnCircle(itemID3, 8000,  12, 560);
					bossSkillID.msg = bossSkillID.msg2
				}
			}
			// 滚开 内外圈
			if (skillid===138) {
				SpawnCircle(itemID3, 5000, 18, 250);
			}
			// 前砸 后喷
			if (skillid===152) {
				SpawnThing(   false,  100, 180,  30);
				SpawnString(itemID3, 5000,  60, 500);
				SpawnString(itemID3, 5000, 300, 500);
			}
			// 后喷 前戳
			if (skillid===701) {
				SpawnThing(   false,  100,   0,  60);
				SpawnString(itemID3, 2000,  60, 500);
				SpawnString(itemID3, 2000, 300, 500);
			}
			sendMessage(bossSkillID.msg);
		}
		
		// RK_1王
		if ([735, 935].includes(whichmode) && event.templateId==1000 && (bossSkillID = RK_BOSS_1.find(obj => obj.id === skillid))) {
			if (event.stage!==0) return;
			// 披萨_1 前右
			if (skillid===315||skillid===319) {
				mod.setTimeout(() => {
					SpawnString(itemID3, 14000, 180, 800);
					SpawnString(itemID3, 14000, 135, 800);
				}, 1000);
			}
			// 披萨_2 右上
			if (skillid===311||skillid===323) {
				mod.setTimeout(() => {
					SpawnString(itemID3, 14000, 135, 800);
					SpawnString(itemID3, 14000,  90, 800);
				}, 1000);
			}
			// 披萨_3 右下
			if (skillid===312||skillid===324) {
				mod.setTimeout(() => {
					SpawnString(itemID3, 14000,  90, 800);
					SpawnString(itemID3, 14000,  45, 800);
				}, 1000);
			}
			// 披萨_4 后右
			if (skillid===316||skillid===320) {
				mod.setTimeout(() => {
					SpawnString(itemID3, 14000,  45, 800);
					SpawnString(itemID3, 14000,   0, 800);
				}, 1000);
			}
			// 披萨_5 后左
			if (skillid===313||skillid===321) {
				mod.setTimeout(() => {
					SpawnString(itemID3, 14000,   0, 800);
					SpawnString(itemID3, 14000, 315, 800);
				}, 1000);
			}
			// 披萨_6 左下
			if (skillid===317||skillid===325) {
				mod.setTimeout(() => {
					SpawnString(itemID3, 14000, 315, 800);
					SpawnString(itemID3, 14000, 270, 800);
				}, 1000);
			}
			// 披萨_7 左上
			if (skillid===318||skillid===322) {
				mod.setTimeout(() => {
					SpawnString(itemID3, 14000, 270, 800);
					SpawnString(itemID3, 14000, 225, 800);
				}, 1000);
			}
			// 披萨_8 前左
			if (skillid===314||skillid===326) {
				mod.setTimeout(() => {
					SpawnString(itemID3, 14000, 225, 800);
					SpawnString(itemID3, 14000, 180, 800);
				}, 1000);
			}
			// 全屏轰炸
			if (skillid===309) {
				mod.setTimeout(() => { sendMessage(bossSkillID.msg); }, 12000);
				return;
			}
			sendMessage(bossSkillID.msg);
		}
		// RK_2王
		if ([735, 935].includes(whichmode) && event.templateId==2000 && (bossSkillID = RK_BOSS_2.find(obj => obj.id === skillid))) {
			// 后喷
			if (skillid===108) {
				SpawnString(itemID3, 3000,  60, 500);
				SpawnString(itemID3, 3000, 300, 500);
			}
			// 旋转
			if (skillid===105) {
				SpawnCircle(itemID3, 5000, 8, 278);
			}
			// 吸附
			if (skillid===305) {
				SpawnCircle(itemID3, 3000, 18, 200);
			}
			// 爆炸
			if (skillid===304) {
				SpawnCircle(itemID3, 4000, 8, 400);
			}
			sendMessage(bossSkillID.msg);
		}
		// RK_3王
		if ([735, 935].includes(whichmode) && event.templateId==3000 && (bossSkillID = RK_BOSS_3.find(obj => obj.id === skillid))) {
			if (event.stage!==0) return;
			// 左S拳
			if (skillid===117||skillid===118) {
				SpawnItem(  6, 3000, 170, 200);
				SpawnItem(548, 3000, 170, 210);
				SpawnItem(548, 3000, 170, 230);
				SpawnItem(548, 3000, 170, 250);
				SpawnItem(548, 3000, 170, 270);
				SpawnItem(548, 3000, 170, 290);
				
				SpawnItem(548, 3000, 160, 210);
				SpawnItem(548, 3000, 150, 220);
				SpawnItem(548, 3000, 140, 230);
				SpawnItem(548, 3000, 130, 240);
				SpawnItem(548, 3000, 120, 250);
				
				SpawnItem(  6, 3000, 350, 200);
				SpawnItem(548, 3000, 350, 210);
				SpawnItem(548, 3000, 350, 230);
				SpawnItem(548, 3000, 350, 250);
				SpawnItem(548, 3000, 350, 270);
				SpawnItem(548, 3000, 350, 290);
				
				SpawnItem(548, 3000, 340, 210);
				SpawnItem(548, 3000, 330, 220);
				SpawnItem(548, 3000, 320, 230);
				SpawnItem(548, 3000, 310, 240);
				SpawnItem(548, 3000, 300, 250);
				
				if (isTank) bossSkillID.msg = bossSkillID.msg_tk;
			}
			// 右S拳
			if (skillid===119||skillid===116) {
				SpawnItem(  6, 3000, 190, 200);
				SpawnItem(548, 3000, 190, 210);
				SpawnItem(548, 3000, 190, 230);
				SpawnItem(548, 3000, 190, 250);
				SpawnItem(548, 3000, 190, 270);
				SpawnItem(548, 3000, 190, 290);
				
				SpawnItem(548, 3000, 200, 210);
				SpawnItem(548, 3000, 210, 220);
				SpawnItem(548, 3000, 220, 230);
				SpawnItem(548, 3000, 230, 240);
				SpawnItem(548, 3000, 240, 250);
				
				SpawnItem(  6, 3000, 10, 200);
				SpawnItem(548, 3000, 10, 210);
				SpawnItem(548, 3000, 10, 230);
				SpawnItem(548, 3000, 10, 250);
				SpawnItem(548, 3000, 10, 270);
				SpawnItem(548, 3000, 10, 290);
				
				SpawnItem(548, 3000, 20, 210);
				SpawnItem(548, 3000, 30, 220);
				SpawnItem(548, 3000, 40, 230);
				SpawnItem(548, 3000, 50, 240);
				SpawnItem(548, 3000, 60, 250);
				
				if (isTank) bossSkillID.msg = bossSkillID.msg_tk;
			}
			// 火箭拳 后喷
			if (skillid===128) {
				mod.setTimeout(() => {
					SpawnString(itemID3, 3000,  60, 1200);
					SpawnString(itemID3, 3000, 300, 1200);
				}, 2000)
			}
			// 破盾
			if (skillid===321) {
				mod.setTimeout(() => {
					sendMessage(RK_TipMsg[4])
				}, 90000)
			}
			// 雷达
			if (skillid===323||skillid===324) {
				SpawnCircle(itemID3, 5000, 8, 300);
			}
			sendMessage(bossSkillID.msg);
		}
		
		// RR_1王
		if ([739, 939].includes(whichmode) && event.templateId==1000 && (bossSkillID = RR_BOSS_1.find(obj => obj.id === skillid))) {
			sendMessage(bossSkillID.msg);
		}
		// RR_2王
		if ([739, 939].includes(whichmode) && event.templateId==2000 && (bossSkillID = RR_BOSS_2.find(obj => obj.id === skillid))) {
			// 前喷
			if (skillid===119) {
				SpawnString(itemID3, 3000, 130, 500);
				SpawnString(itemID3, 3000, 230, 500);
			}
			// 后喷
			if (skillid===120) {
				SpawnString(itemID3, 3000,  45, 500);
				SpawnString(itemID3, 3000, 315, 500);
			}
			sendMessage(bossSkillID.msg);
		}
		// RR_3王
		if ([739, 939].includes(whichmode) && event.templateId==3000 && (bossSkillID = RR_BOSS_3.find(obj => obj.id === skillid))) {
			sendMessage(bossSkillID.msg);
		}
		
		// AA_1王
		if ([720, 920, 3017].includes(whichmode) && event.templateId==1000 && (bossSkillID = AA_BOSS_1.find(obj => obj.id === skillid))) {
			sendMessage(bossSkillID.msg);
		}
		// AA_2王
		if ([720, 920, 3017].includes(whichmode) && event.templateId==2000 && (bossSkillID = AA_BOSS_2.find(obj => obj.id === skillid))) {
			sendMessage(bossSkillID.msg);
		}
		// AA_3王
		if ([720, 920, 3017].includes(whichmode) && event.templateId==3000 && (bossSkillID = AA_BOSS_3.find(obj => obj.id === skillid))) {
			if (event.stage!==0) return;
			// 后砸技能判定
			if (skillid===104) {
				if (Date.now() - lastRotationDate > 1200) {
					rotationDelay = 0;
				}
				if (Date.now() - lastTwoUpDate - rotationDelay < 2900) {
					sendMessage(bossSkillID.msg);
				}
				lastTwoUpDate = Date.now();
			} else {
				lastTwoUpDate = 0;
				lastRotationDate = 0;
				// 3王 左/右刀
				if (skillid===109||skillid===111) {
					SpawnString(itemID3, 2000, 180, 500); // 垂直对称轴 头部
					SpawnString(itemID3, 2000,   0, 500); // 垂直对称轴 尾部
					SpawnThing(true, 2000, bossSkillID.sign_degrees, 250);
					if (isTank) bossSkillID.msg = bossSkillID.msg_tk;
				}
				sendMessage(bossSkillID.msg);
			}
		}
		
		// DRC_1王
		if ([783, 983, 3018].includes(whichmode) && event.templateId==1000 && (bossSkillID = DRC_BOSS_1.find(obj => obj.id === skillid))) {
			// 后跳(眩晕)
			if (skillid===108) {
				SpawnThing(   false,  100, 0,  75);
				SpawnCircle(itemID3, 2000, 6, 470);
			}
			// 蓄力捶地
			if (skillid===119) {
				SpawnThing(   false,  100, 180,  90);
				SpawnCircle(itemID3, 2000,   6, 420);
			}
			sendMessage(bossSkillID.msg);
		}
		// DRC_2王
		if ([783, 983, 3018].includes(whichmode) && event.templateId==2000 && (bossSkillID = DRC_BOSS_2.find(obj => obj.id === skillid))) {
			// 点名(击飞)
			if (skillid===105) {
				SpawnString(itemID3, 3000, 180, 600);
			}
			// 上级 属性攻击 - 草地圈范围
			if (skillid===318) {
				SpawnCircle(itemID3, 5000, 20, 680);
			}
			sendMessage(bossSkillID.msg);
		}
		// DRC_3王
		if ([783, 983, 3018].includes(whichmode) && event.templateId==3000 && (bossSkillID = DRC_BOSS_3.find(obj => obj.id === skillid))) {
			// S攻击
			if (skillid===303||skillid===306) {
				SpawnString(itemID3, 5000,  90, 400);       // 王右侧 直线花朵
				SpawnString(itemID3, 5000, 270, 400);       // 王左侧 直线花朵
				SpawnThing(true, 5000, bossSkillID.sign_degrees1, 250); // 王右侧 光柱+告示牌
				SpawnThing(true, 5000, bossSkillID.sign_degrees2, 250); // 王左侧 光柱+告示牌
			}
			sendMessage(bossSkillID.msg);
		}
		
		// GLS_1王
		if ([782, 982, 3019].includes(whichmode) && event.templateId==1000 && (bossSkillID = GLS_BOSS_1.find(obj => obj.id === skillid))) {
			// 后喷
			if (skillid===107) {
				SpawnString(itemID3, 3000,  45, 500);
				SpawnString(itemID3, 3000, 315, 500);
			}
			sendMessage(bossSkillID.msg);
		}
		// GLS_2王
		if ([782, 982, 3019].includes(whichmode) && event.templateId==2000 && (bossSkillID = GLS_BOSS_2.find(obj => obj.id === skillid))) {
			// 内外圈
			if (skillid===301) { // 捶地+旋转
				SpawnCircle(itemID3, 5000, 8, 260);
				SpawnCircle(itemID3, 5000, 6, 580);
			}
			if (skillid===302) { // 旋转+捶地
				SpawnCircle(itemID3, 5000, 8, 260);
				SpawnCircle(itemID3, 5000, 6, 680);
			}
			if (skillid===114) { // 三连拍
				SpawnCircle(itemID3, 5000, 8, 260);
				SpawnCircle(itemID3, 5000, 6, 580);
			}
			// 前砸后砸 横向对称轴
			if (skillid===116) {
				SpawnString(itemID3, 5000,  90, 500); // 右侧直线花朵
				SpawnString(itemID3, 5000, 270, 500); // 左侧直线花朵
			}
			sendMessage(bossSkillID.msg);
		}
		// GLS_3王
		if ([782, 982, 3019].includes(whichmode) && event.templateId==3000 && (bossSkillID = GLS_BOSS_3.find(obj => obj.id === skillid))) {
			// 蓄电层数计数系统
			if (whichmode==982) {
				if (skillid===300) Level = 0, levelMsg = bossSkillID.level_Msg, power = true; // 一次觉醒 开始充能计数
				if (skillid===360) Level = 0;                                                 // 放电爆炸 重置充能计数
				if (skillid===399) Level = 0, levelMsg = bossSkillID.level_Msg;               // 二次觉醒 重置充能计数
				// 充能开关打开 并且 施放以下技能 则增加一层
				if (power) {
					// 三连击, 左后, 左后 (扩散), 右后, 右后 (扩散), 后砸前砸, 尾巴
					if ([118, 143, 145, 146, 154, 144, 147, 148, 155, 161, 162, 213, 215].includes(skillid)) {
						powerMsg = ' | ' + levelMsg[Level];
						Level++;
					} else {
						powerMsg = '';
					}
				}
				// 屏蔽[三连击]技能连续触发充能
				if (power && (skillid===118)) {
					power = false;
					mod.setTimeout(() => { power = true }, 4000);
				}
			}
			// 左/右扩散电圈标记
			if ([146, 154, 148, 155].includes(skillid)) {
				// 中心点告示牌标记 持续8秒
				SpawnThing(true, 8000, bossSkillID.sign_degrees, bossSkillID.sign_distance);
				// 花圈范围 延迟2.5秒出现 持续5.5秒
				mod.setTimeout(() => {
					SpawnCircle(itemID3, 5500, 15, 160);
					SpawnCircle(itemID3, 5500, 12, 320);
					SpawnCircle(itemID3, 5500, 10, 480);
					SpawnCircle(itemID3, 5500,  8, 640);
					SpawnCircle(itemID3, 5500,  6, 800);
				}, 2500); 
			}
			// 飞天半屏左/右攻击
			if ([139, 150, 141, 152].includes(skillid)) {
				SpawnString(itemID3, 2000, 180, 500); // 垂直对称轴 头部
				SpawnString(itemID3, 2000,   0, 225); // 垂直对称轴 尾部
				SpawnItem(  itemID5, 2000,   0, 250); // 垂直对称轴 尾部特殊标记
				SpawnItem(  itemID5, 2000,   0, 350);
				SpawnItem(  itemID5, 2000,   0, 450);
				SpawnThing(true, 2000, bossSkillID.sign_degrees, 250); // 光柱+告示牌
			}
			sendMessage(bossSkillID.msg + powerMsg);
		}
		
		// 巴哈勒
		if (whichmode===444 && [1000, 2000].includes(event.templateId) && (bossSkillID = Baharr.find(obj => obj.id === skillid))) {
			// 前砸 103 104
			if (skillid===103) {
				SpawnThing(   false,  100, 184, 400);
				SpawnCircle(itemID3, 3000,   8, 350);
			}
			// 右前砸 125 126 127
			if (skillid===125) {
				SpawnThing(   false,  100, 184, 400);
				SpawnCircle(itemID3, 3000,   8, 350);
				mod.setTimeout(() => { // 右后拉
					SpawnThing(   false,  100,  90, 200);
					SpawnString(itemID3, 2000, 180, 500);
					SpawnString(itemID3, 2000,   0, 500);
				}, 3000);
			}
			// 左前砸 131 132 134
			if (skillid===131) {
				SpawnThing(   false,  100, 182, 340);
				SpawnCircle(itemID3, 4000,   8, 660);
				mod.setTimeout(() => { // 左后拉
					SpawnThing(   false,  100, 270, 200);
					SpawnString(itemID3, 2000, 180, 500);
					SpawnString(itemID3, 2000,   0, 500);
				}, 4000);
			}
			// 点名后捶地
			if (skillid===114) {
				SpawnThing(   false,  100, 184, 260);
				SpawnCircle(itemID3, 4000,  10, 320);
			}
			// 点名后甜甜圈
			if (skillid===116) {
				SpawnCircle(itemID3, 6000, 8, 290);
			}
			// 后砸 / 慢后砸
			if (skillid===111||skillid===137) {
				SpawnThing(   false,  100, 0, 500);
				SpawnCircle(itemID3, 2000, 8, 480);
			}
			// 完美格挡
			if (skillid===112||skillid===135) {
				SpawnThing(   false,  100, 184, 220);
				SpawnCircle(itemID3, 4000,  12, 210);
			}
			// 锤地(三连击)
			if (skillid===101) {
				SpawnString(itemID3, 4000, 345, 500); // 对称轴 尾部
				SpawnString(itemID3, 3000, 270, 500); // 对称轴 左侧
			}
			// 四连半月
			if ([121, 122, 123, 140, 141, 142].includes(skillid)) {
				SpawnThing(   false,  100,  90,  50);
				SpawnString(itemID3, 6000,   0, 500);
				SpawnString(itemID3, 6000, 180, 500);
				
				SpawnThing(   false,  100, 270, 100);
				SpawnString(itemID3, 6000,   0, 500);
				SpawnString(itemID3, 6000, 180, 500);
				
				mod.setTimeout(() => {
					sendMessage(Baharr_TipMsg[0], 25);
				}, 60000);
			}
			// 二阶 左/右手放锤 左/右半屏击飞
			if (skillid===119||skillid===120) {
				SpawnString(itemID3, 2000, 180, 500); // 垂直对称轴 头部
				SpawnString(itemID3, 2000,   0, 500); // 垂直对称轴 尾部
				SpawnThing(true, 5000, bossSkillID.sign_degrees, 250);
				if (isTank) bossSkillID.msg = bossSkillID.msg_tk;
			}
			sendMessage(bossSkillID.msg);
		}
		
		// 蝴蝶_1王
		if ([3101, 3201].includes(whichmode) && event.templateId==1000 && (bossSkillID = GV_BOSS_1.find(obj => obj.id === skillid))) {
			if (event.stage!==0) return;
			// 直线后喷
			if (skillid===127) {
				SpawnThing(   false,  100,  90, 140);
				SpawnString(itemID3, 3000,   7, 500);
				SpawnThing(   false,  100, 270, 140);
				SpawnString(itemID3, 3000, 353, 500);
			}
			// 扇形后喷
			if (skillid===131) {
				SpawnThing(   false,  100, 180, 100);
				SpawnString(itemID3, 3000,  70, 800);
				SpawnString(itemID3, 3000, 290, 800);
			}
			// 左右喷射
			if (skillid===132) {
				SpawnString(itemID3, 3000, 340, 800);
				SpawnString(itemID3, 3000,  20, 800);
				SpawnString(itemID3, 3000, 160, 800);
				SpawnString(itemID3, 3000, 200, 800);
			}
			// 前后喷射
			if (skillid===139) {
				SpawnString(itemID3, 3000,  70, 800);
				SpawnString(itemID3, 3000, 110, 800);
				SpawnString(itemID3, 3000, 250, 800);
				SpawnString(itemID3, 3000, 290, 800);
			}
			// 右手蓄力
			if (skillid===148) {
				SpawnThing(  false,   100, 150, 140);
				SpawnCircle(itemID3, 3000,  10, 320);
			}
			// 左手蓄力
			if (skillid===149) {
				SpawnThing(  false,   100, 200, 140);
				SpawnCircle(itemID3, 3000,  10, 320);
			}
			// 内外圈
			if (skillid===313||skillid===314) {
				SpawnThing(   false,  100, 180,  80);
				SpawnCircle(itemID3, 4000,  10, 300);
			}
			sendMessage(bossSkillID.msg);
		}
		// 蝴蝶_2王
		if ([3101, 3201].includes(whichmode) && event.templateId==2000 && (bossSkillID = GV_BOSS_2.find(obj => obj.id === skillid))) {
			if (event.stage!==0) return;
			// 前插 后喷
			if (skillid===108) {
				SpawnThing(   false,  100,  90, 80);
				SpawnString(itemID3, 3000,  10, 1000);
				SpawnThing(   false,  100, 270, 80);
				SpawnString(itemID3, 3000, 350, 1000);
			}
			// 内外圈
			if (skillid===231||skillid===232) {
				SpawnCircle(itemID3, 3000, 10, 300);
			}
			sendMessage(bossSkillID.msg);
		}
		
	}
	// 发送提示文字
	function sendMessage(msg, chl) {
		if (SendToParty) {
			mod.send('C_CHAT', 1, {
				channel: 21, // 21 = p-notice, 1 = party, 2 = guild, 25 = r-notice
				message: msg
			});
		} else if (SendToStream) {
			mod.command.message(msg);
		} else {
			mod.send('S_CHAT', 3 , {
				channel: chl ? chl : 21, // 21 = 队长通知, 1 = 组队, 2 = 公会, 25 = 团长通知
				name: 'DG-Guide',
				message: msg,
			})
		}
	}
	// 地面提示(光柱+告示牌)
	function SpawnThing(show, times, degrees, radius) {          // 是否显示 持续时间 偏移角度 半径距离
		if (SendToStream) return;
	
		var r = null, rads = null, finalrad = null, spawnx = null, spawny = null, pos = null;
		
		r = boss_CurAngle - Math.PI;
		rads = (degrees * Math.PI/180);
		finalrad = r - rads;
		spawnx = boss_CurLocation.x + radius * Math.cos(finalrad);
		spawny = boss_CurLocation.y + radius * Math.sin(finalrad);
		pos = {x:spawnx, y:spawny};
		
		curLocation = new Vec3(pos.x, pos.y, curLocation.z);
		curAngle = boss_CurAngle;
		
		if (!show) return;
		// 告示牌
		mod.send('S_SPAWN_BUILD_OBJECT', 2, {
			gameId : uid1,
			itemId : itemID1,
			loc : new Vec3(pos.x, pos.y, curLocation.z),
			w : isTank ? boss_CurAngle : r,
			ownerName : "TIP",
			message : "TIP"
		});
		// 龙头光柱
		curLocation.z = curLocation.z - 1000;
		mod.send('S_SPAWN_DROPITEM', 8, {
			gameId: uid2,
			loc: new Vec3(pos.x, pos.y, curLocation.z),
			item: itemID2, // 98260-古龙贝勒古斯的头
			amount: 1,
			expiry: 600000
		});
		curLocation.z = curLocation.z + 1000;
		// 延迟消除
		setTimeout(DespawnThing, times, uid1, uid2);
		uid1--;
		uid2--;
	}
	// 消除 光柱+告示牌
	function DespawnThing(uid_arg1, uid_arg2) {
		mod.send('S_DESPAWN_BUILD_OBJECT', 2, {
			gameId : uid_arg1
		});
		mod.send('S_DESPAWN_DROPITEM', 4, {
			gameId: uid_arg2
		});
	}
	// 地面提示(花朵)
	function SpawnItem(item, times, degrees, radius) {           // 显示物品 持续时间 偏移角度 半径距离
		if (SendToStream) return;
		
		var r = null, rads = null, finalrad = null, spawnx = null, spawny = null, pos = null;
		
		r = curAngle - Math.PI;
		rads = (degrees * Math.PI/180);
		finalrad = r - rads;
		spawnx = curLocation.x + radius *Math.cos(finalrad);
		spawny = curLocation.y + radius *Math.sin(finalrad);
		pos = {x:spawnx, y:spawny};
		// 花朵
		mod.send('S_SPAWN_COLLECTION', 4, {
			gameId : uid3,
			id : item,
			amount : 1,
			loc : new Vec3(pos.x, pos.y, curLocation.z),
			w : r
		});
		// 延时消除
		setTimeout(Despawn, times, uid3);
		uid3--;
	}
	// 消除 花朵
	function Despawn(uid_arg3) {
		mod.send('S_DESPAWN_COLLECTION', 2, {
			gameId : uid_arg3
		});
	}
	// 构造 直线花朵
	function SpawnString(item, times, degrees, maxRadius) {      // 显示物品 持续时间 偏移角度 最远距离
		for (var radius=50; radius<=maxRadius; radius+=50) {		// 默认间隔 50
			SpawnItem(item, times, degrees, radius);
		}
	}
	// 构造 圆形花圈
	function SpawnCircle(item, times, intervalDegrees, radius) { // 显示物品 持续时间 偏移间隔 半径距离
		for (var degrees=0; degrees<360; degrees+=intervalDegrees) {
			SpawnItem(item, times, degrees, radius);
		}
	}
	
	mod.hook('C_PLAYER_LOCATION', 5, event => {
		if (!debug) return;
		
		boss_CurLocation = event.loc;
		boss_CurAngle = event.w;
		curLocation = event.loc;
		curAngle = event.w;
	});
	mod.command.add("点", (a1, a2, a3, a4) => {
		if (a1 == 1) a1 = true;
		if (a1 == 0) a1 = false;
		SpawnThing(a1, a2, a3, a4);
	});
	mod.command.add("线", (r1, r2, r3, r4) => {
		Number(r1), Number(r2), Number(r3), Number(r4);
		SpawnString(r1, r2, r3, r4);
	});
	mod.command.add("圆", (g1, g2, g3) => {
		Number(g1), Number(g2), Number(g3);
		SpawnCircle(g1, g2, 10, g3);
	});
	
}
